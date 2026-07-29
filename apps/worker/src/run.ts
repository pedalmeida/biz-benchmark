import { estimateCostCents } from "@bb/shared";
import { expandKeywords } from "./pipeline/keyword-expansion.js";
import {
  discoverCandidatesFirecrawl,
  judgeCandidates,
  rankAndCap,
  type RankedCandidate,
} from "./pipeline/discovery.js";
import { judgeRelevance } from "./pipeline/relevance.js";
import { classifyAds } from "./pipeline/classify.js";
import { crawlFunnel } from "./pipeline/funnel-crawl.js";
import { scrapeAdLibrary } from "./scrape.js";
import {
  updateRun,
  insertDiscoveryCandidates,
  upsertAutoCompetitor,
  insertRunCompetitors,
} from "./queries.js";

class RunCostCapExceededError extends Error {}

// Tracks call counts (not exact tokens — see cost-estimate.ts) across the
// run and aborts BEFORE the next expensive stage once the cap is crossed,
// rather than mid-stage. A run that goes over cost the moment it crosses
// the cap, not one that's already 3 stages past it.
class CostTracker {
  private firecrawlCalls = 0;
  private haikuCalls = 0;
  private sonnetCalls = 0;
  constructor(private readonly runId: string, private readonly capCents: number) {}

  add(delta: { firecrawlCalls?: number; haikuCalls?: number; sonnetCalls?: number }) {
    this.firecrawlCalls += delta.firecrawlCalls ?? 0;
    this.haikuCalls += delta.haikuCalls ?? 0;
    this.sonnetCalls += delta.sonnetCalls ?? 0;
  }

  costCents(): number {
    return estimateCostCents({
      firecrawlCalls: this.firecrawlCalls,
      haikuCalls: this.haikuCalls,
      sonnetCalls: this.sonnetCalls,
    });
  }

  async checkpoint(): Promise<void> {
    const cost = this.costCents();
    await updateRun(this.runId, { cost_cents: Math.round(cost) });
    if (cost > this.capCents) {
      throw new RunCostCapExceededError(
        `estimated cost ${cost.toFixed(1)}c exceeded cap ${this.capCents}c`
      );
    }
  }
}

function slugifyCompetitorId(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const MAX_RELEVANCE_CANDIDATES = 60;

// Runs the full discovery pipeline for one run row that already exists
// with status 'discovering' (see index.ts POST /run, which creates it and
// handles the cache-hit short-circuit before calling this). Every stage
// updates `runs` so a caller polling status sees real progress, mirroring
// the existing scrape_jobs polling pattern in the admin app.
export async function runDiscoveryPipeline(
  runId: string,
  nicheLabel: string,
  country: string
): Promise<void> {
  const maxCompetitors = parseInt(process.env.MAX_COMPETITORS_PER_RUN ?? "8", 10);
  const costCap = parseInt(process.env.RUN_COST_CAP_CENTS ?? "200", 10);
  const cost = new CostTracker(runId, costCap);

  // 3a: keyword expansion
  const { keywords, language } = await expandKeywords(nicheLabel, country);
  cost.add({ haikuCalls: 1 });
  await updateRun(runId, { keywords, language, discovery_method: "firecrawl_keyword" });

  // 3b/3c: raw fetch + dedupe
  const { candidates, totalAdsSeen, keywordErrors } = await discoverCandidatesFirecrawl(
    keywords,
    country
  );
  cost.add({ firecrawlCalls: keywords.length });
  await cost.checkpoint();
  if (keywordErrors.length > 0) {
    console.error(`run ${runId}: ${keywordErrors.length} keyword(s) failed`, keywordErrors);
  }

  // 3d: deterministic filter — write the FULL audit trail now, spam and all
  const judged = judgeCandidates(candidates, totalAdsSeen);
  await insertDiscoveryCandidates(
    runId,
    judged.map((c) => ({
      pageId: null,
      pageSlug: c.pageSlug,
      pageName: c.pageName,
      nameKey: c.nameKey,
      adCount: c.adCount,
      currencies: c.currencies,
      sampleBodies: c.sampleBodies,
      verdict: c.verdict!,
    }))
  );

  const survivors = judged
    .filter((c) => c.verdict === "accepted")
    .sort((a, b) => b.adCount - a.adCount)
    .slice(0, MAX_RELEVANCE_CANDIDATES);

  if (survivors.length === 0) {
    await updateRun(runId, { status: "no_competitors_found", finished: true });
    return;
  }

  // 3e: exactly one LLM call judges every survivor's relevance
  await updateRun(runId, { status: "classifying" });
  const verdicts = await judgeRelevance(survivors, nicheLabel, country);
  cost.add({ sonnetCalls: 1 });
  await cost.checkpoint();
  const verdictByKey = new Map(verdicts.map((v) => [v.nameKey, v]));

  const ranked: RankedCandidate[] = survivors.map((c) => {
    const v = verdictByKey.get(c.nameKey);
    return {
      ...c,
      isRelevant: v?.isRelevant ?? false,
      relevanceScore: v?.confidence ?? 0,
      relevanceReason: v?.reason ?? "no relevance verdict returned",
      businessType: v?.businessType ?? null,
      included: false,
      rank: null,
    };
  });

  // Candidates the LLM ruled off-niche: record it in the same audit trail,
  // no competitor gets created for them.
  const irrelevant = ranked.filter((c) => !c.isRelevant);
  if (irrelevant.length > 0) {
    await insertDiscoveryCandidates(
      runId,
      irrelevant.map((c) => ({
        pageId: null,
        pageSlug: c.pageSlug,
        pageName: c.pageName,
        nameKey: c.nameKey,
        adCount: c.adCount,
        currencies: c.currencies,
        sampleBodies: c.sampleBodies,
        verdict: "rejected_llm",
      }))
    );
  }

  // 3f: rank the relevant survivors and cap — everyone beyond the cap was a
  // real competitor, just not a top one; record that distinctly from "off-niche".
  const finalRanking = rankAndCap(ranked, maxCompetitors);
  const capped = finalRanking.filter((c) => c.isRelevant && !c.included);
  if (capped.length > 0) {
    await insertDiscoveryCandidates(
      runId,
      capped.map((c) => ({
        pageId: null,
        pageSlug: c.pageSlug,
        pageName: c.pageName,
        nameKey: c.nameKey,
        adCount: c.adCount,
        currencies: c.currencies,
        sampleBodies: c.sampleBodies,
        verdict: "rejected_rank",
      }))
    );
  }

  const included = finalRanking.filter((c) => c.included);
  if (included.length === 0) {
    await updateRun(runId, { status: "no_competitors_found", finished: true });
    return;
  }

  // 3f cont'd: auto-create a competitor per included candidate
  await updateRun(runId, { status: "scraping" });
  const competitorIds: { id: string; pageName: string; pageSlug: string | null }[] = [];
  for (const c of included) {
    const id = await upsertAutoCompetitor({
      id: slugifyCompetitorId(c.pageName),
      name: c.pageName,
      metaPageId: null, // populated on the Graph API branch, null here
      metaPageSlug: c.pageSlug,
      businessType: c.businessType,
      hqCountry: country,
    });
    competitorIds.push({ id, pageName: c.pageName, pageSlug: c.pageSlug });
  }

  await insertRunCompetitors(
    runId,
    included.map((c, i) => ({
      competitorId: competitorIds[i].id,
      discoveredVia: c.discoveredVia,
      relevanceScore: c.relevanceScore,
      relevanceReason: c.relevanceReason,
      included: true,
      rank: c.rank,
    }))
  );

  // 3g: deep scrape each included competitor — the existing per-competitor
  // path, unchanged, just called once per discovered business instead of
  // once per manually-typed name. expectedPageSlug filters out unrelated
  // advertisers the keyword search also matched (see scrape.ts).
  for (const { id, pageName, pageSlug } of competitorIds) {
    const result = await scrapeAdLibrary({
      competitorId: id,
      pageHandle: pageName,
      country,
      expectedPageSlug: pageSlug,
    });
    if (result.skippedOtherAdvertisers) {
      console.warn(
        `run ${runId}: ${id} — skipped ${result.skippedOtherAdvertisers} ad(s) from other advertisers`
      );
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  cost.add({ firecrawlCalls: competitorIds.length });
  await cost.checkpoint();

  // 5b: classify hook_angle/traffic_temperature for the ads just scraped —
  // otherwise every run-discovered ad lands with both NULL, same gap the
  // original manual-add pipeline had.
  await updateRun(runId, { status: "classifying" });
  let totalClassified = 0;
  for (const { id } of competitorIds) {
    totalClassified += await classifyAds(id);
  }
  cost.add({ sonnetCalls: Math.ceil(totalClassified / 40) });
  await cost.checkpoint();

  // 6: crawl the top landing page(s) per competitor into funnel_steps/
  // offers/lead_magnets — the page most ads point to is the money page.
  const maxFunnelPages = parseInt(process.env.MAX_FUNNEL_PAGES_PER_COMPETITOR ?? "3", 10);
  await updateRun(runId, { status: "funnels" });
  for (const { id } of competitorIds) {
    await crawlFunnel(id, maxFunnelPages);
  }
  cost.add({ firecrawlCalls: competitorIds.length * maxFunnelPages, sonnetCalls: competitorIds.length });
  await cost.checkpoint();

  await updateRun(runId, { status: "ready", finished: true });
}

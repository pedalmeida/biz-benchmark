import { expandKeywords } from "./pipeline/keyword-expansion.js";
import {
  discoverCandidatesFirecrawl,
  judgeCandidates,
  rankAndCap,
  type RankedCandidate,
} from "./pipeline/discovery.js";
import { judgeRelevance } from "./pipeline/relevance.js";
import { scrapeAdLibrary } from "./scrape.js";
import {
  updateRun,
  insertDiscoveryCandidates,
  upsertAutoCompetitor,
  insertRunCompetitors,
} from "./queries.js";

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

  // 3a: keyword expansion
  const { keywords, language } = await expandKeywords(nicheLabel, country);
  await updateRun(runId, { keywords, language, discovery_method: "firecrawl_keyword" });

  // 3b/3c: raw fetch + dedupe
  const { candidates, totalAdsSeen, keywordErrors } = await discoverCandidatesFirecrawl(
    keywords,
    country
  );
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
  const competitorIds: { id: string; pageName: string }[] = [];
  for (const c of included) {
    const id = await upsertAutoCompetitor({
      id: slugifyCompetitorId(c.pageName),
      name: c.pageName,
      metaPageId: null, // populated on the Graph API branch, null here
      metaPageSlug: c.pageSlug,
      businessType: c.businessType,
      hqCountry: country,
    });
    competitorIds.push({ id, pageName: c.pageName });
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
  // once per manually-typed name.
  for (const { id, pageName } of competitorIds) {
    await scrapeAdLibrary({ competitorId: id, pageHandle: pageName, country });
    await new Promise((r) => setTimeout(r, 2000));
  }

  await updateRun(runId, { status: "ready", finished: true });
}

import { normalizeNameKey, judgeCandidate, type Verdict } from "@radar/shared";
import { fetchAdLibraryMarkdown } from "./fetch-ad-library.js";

export type DiscoveryCandidate = {
  pageName: string;
  pageSlug: string | null;
  nameKey: string;
  adCount: number;
  sampleBodies: string[];
  currencies: string[]; // empty on the Firecrawl branch — no per-ad currency field
  discoveredVia: string; // the keyword that first surfaced this page
  verdict?: Verdict;
};

export type DiscoveryResult = {
  candidates: DiscoveryCandidate[];
  totalAdsSeen: number;
  keywordErrors: { keyword: string; error: string }[];
};

// Branch B: keyword-search the Ad Library once per expanded keyword and
// group results by the parser's page slug (falling back to a normalized
// name key when the markdown didn't yield a slug). This is a SAMPLE, not a
// census — Firecrawl only returns Meta's first results page per keyword
// (~20-30 ads, recency-ordered), so a low-volume advertiser may not surface
// on any of the expanded keywords. That's a known, accepted limitation of
// this branch, not a bug — see the design doc.
export async function discoverCandidatesFirecrawl(
  keywords: string[],
  country: string
): Promise<DiscoveryResult> {
  const byKey = new Map<string, DiscoveryCandidate>();
  const keywordErrors: { keyword: string; error: string }[] = [];
  let totalAdsSeen = 0;

  for (const keyword of keywords) {
    const { ads, error } = await fetchAdLibraryMarkdown(keyword, country);
    if (error) {
      keywordErrors.push({ keyword, error });
      continue; // one bad keyword shouldn't fail the whole run
    }
    totalAdsSeen += ads.length;

    for (const ad of ads) {
      if (!ad.advertiser_page) continue;
      const key = ad.advertiser_page_slug ?? normalizeNameKey(ad.advertiser_page);
      const existing = byKey.get(key);
      if (existing) {
        existing.adCount++;
        if (existing.sampleBodies.length < 3 && ad.body) existing.sampleBodies.push(ad.body);
      } else {
        byKey.set(key, {
          pageName: ad.advertiser_page,
          pageSlug: ad.advertiser_page_slug,
          nameKey: key,
          adCount: 1,
          sampleBodies: ad.body ? [ad.body] : [],
          currencies: [],
          discoveredVia: keyword,
        });
      }
    }

    // Be polite between requests — this is the same Firecrawl scrape the
    // per-competitor deep scrape uses, just pointed at different keywords.
    await new Promise((r) => setTimeout(r, 1500));
  }

  return { candidates: Array.from(byKey.values()), totalAdsSeen, keywordErrors };
}

// A run with zero survivors normally means "this niche has no advertisers we
// could accept" — a real market finding. But an empty candidate list also
// comes out of a total provider outage (every Firecrawl call failing), and
// those two must never look the same: one is a conclusion, the other is a
// broken run. Returns a user-facing failure message when discovery never
// actually observed the market, or null when the results can be trusted.
export function describeDiscoveryFailure(
  keywords: string[],
  keywordErrors: { keyword: string; error: string }[]
): string | null {
  if (keywords.length === 0) {
    return "Discovery failed: keyword expansion returned no keywords, so the Ad Library was never searched. Check the Anthropic API key and retry.";
  }
  if (keywordErrors.length < keywords.length) return null;

  const firstError = keywordErrors[0]?.error ?? "unknown error";
  return `Discovery failed: all ${keywords.length} Ad Library searches failed, so no competitor data was collected. This is a provider or network failure, not an empty market. First error: ${firstError}. Check the Firecrawl API key and retry.`;
}

export type RankedCandidate = DiscoveryCandidate & {
  isRelevant: boolean;
  relevanceScore: number;
  relevanceReason: string;
  businessType: string | null;
  included: boolean;
  rank: number | null;
};

// 3f: rank relevance-approved survivors by ad volume (a proxy for how
// seriously this advertiser is investing) and cap at maxCompetitors. Every
// candidate that reached this stage is returned, `included` marks whether
// it made the cut — callers persist ALL of them to run_competitors so the
// cut itself is auditable, not just the winners.
export function rankAndCap(
  candidates: RankedCandidate[],
  maxCompetitors: number
): RankedCandidate[] {
  const relevant = candidates
    .filter((c) => c.isRelevant)
    .sort((a, b) => b.adCount - a.adCount);

  const irrelevant = candidates.filter((c) => !c.isRelevant);

  return [
    ...relevant.map((c, i) => ({ ...c, included: i < maxCompetitors, rank: i + 1 })),
    ...irrelevant.map((c) => ({ ...c, included: false, rank: null })),
  ];
}

// Applies the deterministic filter rules from @radar/shared to every raw
// candidate. Mutates nothing — returns a new array with `verdict` set.
// The Firecrawl branch has no currency signal, so `expectedCurrency` is
// always null here (the currency rule becomes a no-op on this branch).
export function judgeCandidates(
  candidates: DiscoveryCandidate[],
  totalAdsSeen: number
): DiscoveryCandidate[] {
  return candidates.map((c) => ({
    ...c,
    verdict: judgeCandidate(
      {
        pageName: c.pageName,
        adCount: c.adCount,
        currencies: c.currencies,
        sampleBodies: c.sampleBodies,
        totalAdsInBatch: totalAdsSeen,
      },
      null
    ),
  }));
}

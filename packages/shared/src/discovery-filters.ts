// Deterministic, cheap discovery-candidate filtering — runs before the one
// LLM relevance call so that call only sees plausible survivors. Every rule
// here was derived from a real spam page observed in testing: a page named
// "Crasglogrushe Stegloldnege" flooded 20 of 25 results for "clínica
// dentária" in PT with empty ad text and USD pricing in a EUR market.

export type DiscoveryCandidateInput = {
  pageName: string;
  adCount: number;
  currencies: string[];
  sampleBodies: string[]; // ad body text, a few per candidate
  totalAdsInBatch: number; // to compute this candidate's share of the batch
};

export type Verdict =
  | "accepted"
  | "rejected_gibberish"
  | "rejected_currency"
  | "rejected_empty"
  | "rejected_outlier";

const LEGAL_SUFFIXES = /\b(lda|unipessoal|sa|s\.a\.|ltd|inc|llc)\b\.?/gi;

// Strips a trailing " - City" or " | City" location suffix, e.g.
// "Clínica Santa Madalena - Santarém" -> "Clínica Santa Madalena".
const LOCATION_SUFFIX = /\s*[-|]\s*[^-|]+$/;

export function normalizeNameKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(LOCATION_SUFFIX, "")
    .replace(LEGAL_SUFFIXES, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

// A real business name has vowels spread through it. A page keyword-stuffed
// or randomly generated tends to have either near-zero vowels or long
// unbroken consonant runs. Checked per token (space-separated word), not
// the whole name, so "Trinity Clinic l Clínica Dentária" isn't penalized
// for the mixed short tokens.
export function isGibberishName(name: string): boolean {
  const tokens = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length >= 8);

  for (const token of tokens) {
    const vowels = (token.match(/[aeiou]/g) ?? []).length;
    const vowelRatio = vowels / token.length;
    const longestConsonantRun = Math.max(
      0,
      ...(token.match(/[^aeiou]+/g) ?? []).map((run) => run.length)
    );
    if (vowelRatio < 0.28 || longestConsonantRun >= 5) return true;
  }
  return false;
}

export function hasEmptyCreative(bodies: string[]): boolean {
  if (bodies.length === 0) return true;
  const emptyCount = bodies.filter((b) => b.trim().length < 20).length;
  return emptyCount / bodies.length >= 0.7;
}

// Only meaningful on the Graph API branch, which returns a currency per ad.
// The Firecrawl branch has no currency field — callers should skip this
// check there (pass an empty `expectedCurrency` to no-op it).
export function hasCurrencyMismatch(
  currencies: string[],
  expectedCurrency: string | null
): boolean {
  if (!expectedCurrency || currencies.length === 0) return false;
  return currencies.every((c) => c !== expectedCurrency);
}

export function isKeywordStuffingOutlier(
  adCount: number,
  totalAdsInBatch: number
): boolean {
  if (totalAdsInBatch === 0) return false;
  return adCount / totalAdsInBatch > 0.4;
}

export function judgeCandidate(
  input: DiscoveryCandidateInput,
  expectedCurrency: string | null
): Verdict {
  // Currency and gibberish are hard, standalone rejects — either one alone
  // is enough evidence, no other signal needed.
  if (hasCurrencyMismatch(input.currencies, expectedCurrency)) return "rejected_currency";
  if (isGibberishName(input.pageName)) return "rejected_gibberish";
  if (hasEmptyCreative(input.sampleBodies)) return "rejected_empty";
  // Outlier share alone isn't damning (a real market leader can legitimately
  // dominate a keyword), so it only rejects combined with another weak signal.
  if (
    isKeywordStuffingOutlier(input.adCount, input.totalAdsInBatch) &&
    (isGibberishName(input.pageName) || hasEmptyCreative(input.sampleBodies))
  ) {
    return "rejected_outlier";
  }
  return "accepted";
}

// Rough, deliberately conservative cost estimates used ONLY to gate a run
// against RUN_COST_CAP_CENTS before it runs away — not for billing or
// invoicing. Calibrate the constants below against your actual Firecrawl
// and Anthropic invoices once you have a few real runs to compare against;
// these are public list-price ballparks, not measured from your account.

// Firecrawl: ~$0.001-0.003 per scrape credit depending on plan tier.
export const FIRECRAWL_CENTS_PER_CALL = 0.2;

// Blended Claude cost per call, generously rounded up per call tier rather
// than computed from exact token counts (simpler to reason about, and this
// is a cap check, not an invoice) — Haiku calls (keyword expansion) are
// cheap; Sonnet calls (relevance, classify, funnel extraction) cost more.
export const CLAUDE_HAIKU_CENTS_PER_CALL = 0.1;
export const CLAUDE_SONNET_CENTS_PER_CALL = 3;

export type RunCostEstimate = {
  firecrawlCalls: number;
  haikuCalls: number;
  sonnetCalls: number;
};

export function estimateCostCents(usage: RunCostEstimate): number {
  return (
    usage.firecrawlCalls * FIRECRAWL_CENTS_PER_CALL +
    usage.haikuCalls * CLAUDE_HAIKU_CENTS_PER_CALL +
    usage.sonnetCalls * CLAUDE_SONNET_CENTS_PER_CALL
  );
}

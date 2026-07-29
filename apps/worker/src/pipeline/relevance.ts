import Anthropic from "@anthropic-ai/sdk";
import type { DiscoveryCandidate } from "./discovery.js";

// A real judgment call ("is this actually a dental clinic, not a supply
// wholesaler or an insurer"), so this uses the same model tier as the
// framework analyses, not the cheap keyword-expansion model.
const MODEL = "claude-sonnet-4-6";

export type RelevanceVerdict = {
  nameKey: string;
  isRelevant: boolean;
  confidence: number; // 0..1
  businessType: string | null;
  reason: string;
};

function extractJson(text: string): unknown {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  const raw = match ? match[1] : text;
  return JSON.parse(raw);
}

// Exactly ONE Claude call per run, regardless of survivor count (capped at
// 60 candidates by the caller) — this is deliberately the only place an
// LLM is used in discovery. Deterministic rules can't tell "is this really
// a dental clinic" from "is this a dental supply wholesaler that happens to
// run ads with the same keywords" — that's a semantic judgment, not a spam
// check.
export async function judgeRelevance(
  candidates: DiscoveryCandidate[],
  nicheLabel: string,
  country: string
): Promise<RelevanceVerdict[]> {
  if (candidates.length === 0) return [];

  const table = candidates
    .map((c, i) => {
      const bodies = c.sampleBodies.slice(0, 2).map((b) => b.replace(/\s+/g, " ").slice(0, 200));
      return `${i + 1}. name_key="${c.nameKey}" page_name="${c.pageName}" ad_count=${c.adCount} samples=${JSON.stringify(bodies)}`;
    })
    .join("\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: `A user is benchmarking competitors in the niche "${nicheLabel}" (${country}). Below are Meta Ad Library advertiser pages that surfaced when searching keywords related to that niche. Some are genuine competitors; some are off-niche businesses that merely share a keyword (e.g. a dental supply wholesaler, an insurer, a training course, a telehealth app), and should be excluded.

${table}

For EACH numbered row, decide if it's a genuine, direct competitor a business owner in "${nicheLabel}" (${country}) would actually want benchmarked — not just keyword-adjacent.

Output ONLY a fenced JSON array, one object per row, in the same order, nothing else:
\`\`\`json
[{"name_key": "...", "is_relevant": true, "confidence": 0.9, "business_type": "dental clinic", "reason": "..."}, ...]
\`\`\``,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = extractJson(text) as Array<{
    name_key: string;
    is_relevant: boolean;
    confidence: number;
    business_type: string | null;
    reason: string;
  }>;

  return parsed.map((p) => ({
    nameKey: p.name_key,
    isRelevant: p.is_relevant,
    confidence: p.confidence,
    businessType: p.business_type,
    reason: p.reason,
  }));
}

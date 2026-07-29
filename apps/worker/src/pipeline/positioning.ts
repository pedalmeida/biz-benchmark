import Anthropic from "@anthropic-ai/sdk";
import { getSql } from "../db.js";

// Same tier as relevance/classify — synthesizing a value ladder and
// positioning from raw funnel/offer/ad data is a real judgment call.
const MODEL = "claude-sonnet-4-6";

function extractJson(text: string): unknown {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  return JSON.parse(match ? match[1] : text);
}

type ValueLadderRung = {
  rung: string;
  offer: string;
  price: string | number | null;
  type: string;
  url?: string | null;
  description?: string | null;
};

type PositioningResult = {
  value_ladder: ValueLadderRung[];
  archetype: string | null;
  funnel_archetype: string | null;
  voice_descriptor: string | null;
  audience_target: string | null;
  positioning_notes: string | null;
  one_line_summary: string | null;
};

const ARCHETYPES = ["sage", "reluctant-hero", "adventurer", "everyman", "ruler", "creator"];
const FUNNEL_ARCHETYPES = ["opt-in", "webinar", "application", "bridge", "continuity", "summit"];

// Synthesizes a value ladder + positioning summary from data already
// gathered by discovery/scrape/funnel-crawl — no new scraping, this is
// pure synthesis over funnel_steps + offers + top ads. The one thing the
// original hand-curated dossier had that automatic discovery didn't:
// competitors landed with an empty Value Ladder tab because nothing wrote
// to `competitors.value_ladder`/`archetype`/etc. This closes that gap.
export async function generatePositioning(competitorId: string): Promise<boolean> {
  const sql = getSql();

  const [competitorRows, funnelSteps, offers, topAds] = (await Promise.all([
    sql`SELECT name, business_type FROM competitors WHERE id = ${competitorId}`,
    sql`SELECT step_role, url, hero_headline, primary_cta, body_excerpt FROM funnel_steps WHERE competitor_id = ${competitorId} ORDER BY step_index`,
    sql`SELECT name, url, category, price_actual, currency, guarantee, scarcity FROM offers WHERE competitor_id = ${competitorId}`,
    sql`SELECT headline, body, hook_angle, cta FROM ads WHERE competitor_id = ${competitorId} ORDER BY duration_days DESC NULLS LAST LIMIT 10`,
  ])) as [{ name: string; business_type: string | null }[], unknown[], unknown[], unknown[]];

  if (competitorRows.length === 0) return false;
  const competitor = competitorRows[0];

  // Nothing to synthesize from — funnel crawl found no pages and there are
  // no ads yet. Leave the competitor's positioning fields untouched rather
  // than have the model invent a ladder from nothing.
  if (funnelSteps.length === 0 && offers.length === 0 && topAds.length === 0) return false;

  const block = (label: string, rows: unknown[]) =>
    rows.length > 0 ? `## ${label}\n${JSON.stringify(rows, null, 2)}` : "";

  const dataBlock = [
    block("Funnel steps (in order)", funnelSteps),
    block("Offers found on their pages", offers),
    block("Top ads (by duration)", topAds),
  ]
    .filter(Boolean)
    .join("\n\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `Business: "${competitor.name}" (${competitor.business_type ?? "unknown type"}).

${dataBlock}

From this data, synthesize:
1. **value_ladder**: the offer ladder from free/cheap to expensive, ordered. Only include rungs you have actual evidence for (a real offer, price, or funnel step) — do not invent rungs. Each rung: {"rung": "1st|2nd|...", "offer": "name", "price": number or string or null, "type": "intro|flagship|premium|continuity|one-off", "url": "..." or null, "description": "one line"}.
2. **archetype**: pick the single best fit from [${ARCHETYPES.join(", ")}], or null if there's not enough evidence.
3. **funnel_archetype**: pick the single best fit from [${FUNNEL_ARCHETYPES.join(", ")}] based on the funnel steps, or null.
4. **voice_descriptor**: 2-4 words describing their brand voice (e.g. "clinical, reassuring" or "bold, results-first").
5. **audience_target**: one sentence, who this is for.
6. **positioning_notes**: 1-2 sentences on how they position themselves vs. a generic competitor in this space.
7. **one_line_summary**: one sentence describing this business.

Never invent facts not supported by the data above. If you don't have enough signal for a field, use null (or [] for value_ladder).

Output ONLY a fenced JSON object, nothing else:
\`\`\`json
{"value_ladder": [...], "archetype": null, "funnel_archetype": null, "voice_descriptor": null, "audience_target": null, "positioning_notes": null, "one_line_summary": null}
\`\`\``,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const result = extractJson(text) as PositioningResult;

  const archetype = ARCHETYPES.includes(result.archetype ?? "") ? result.archetype : null;
  const funnelArchetype = FUNNEL_ARCHETYPES.includes(result.funnel_archetype ?? "")
    ? result.funnel_archetype
    : null;

  await sql`
    UPDATE competitors SET
      value_ladder      = ${JSON.stringify(result.value_ladder ?? [])},
      archetype         = ${archetype},
      funnel_archetype  = ${funnelArchetype},
      voice_descriptor  = ${result.voice_descriptor ?? null},
      audience_target   = ${result.audience_target ?? null},
      positioning_notes = ${result.positioning_notes ?? null},
      one_line_summary  = COALESCE(${result.one_line_summary ?? null}, one_line_summary),
      updated_at        = NOW()
    WHERE id = ${competitorId}
  `;

  return true;
}

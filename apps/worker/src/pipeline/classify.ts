import Anthropic from "@anthropic-ai/sdk";
import { HOOK_ANGLES, TRAFFIC_TEMPERATURES, isValidTaxonomyValue } from "@radar/shared";
import { getSql } from "../db.js";

// Same tier as the relevance pass — classifying a hook's angle is a real
// judgment call ("is this social proof or authority"), not a lookup.
const MODEL = "claude-sonnet-4-6";
const BATCH_SIZE = 40;

type AdToClassify = { id: string; library_id: string; headline: string | null; body: string | null };

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function extractJson(text: string, truncated: boolean): unknown {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  const raw = match ? match[1] : text;
  try {
    return JSON.parse(raw);
  } catch (err) {
    if (truncated) {
      throw new Error(
        `LLM response was truncated (hit max_tokens) before the JSON closed — reduce batch size or raise max_tokens. Raw tail: ${raw.slice(-200)}`
      );
    }
    throw err;
  }
}

async function classifyBatch(
  ads: AdToClassify[]
): Promise<{ library_id: string; hook_angle: string | null; traffic_temperature: string | null }[]> {
  const hookList = HOOK_ANGLES.map((h) => `${h.value}: ${h.description}`).join("\n");
  const tempList = TRAFFIC_TEMPERATURES.map((t) => `${t.value}: ${t.description}`).join("\n");

  const table = ads
    .map((a, i) => `${i + 1}. library_id="${a.library_id}" headline="${(a.headline ?? "").slice(0, 150)}" body="${(a.body ?? "").replace(/\s+/g, " ").slice(0, 300)}"`)
    .join("\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    messages: [
      {
        role: "user",
        content: `Classify each ad below on two dimensions.

HOOK ANGLE (pick the single best fit):
${hookList}

TRAFFIC TEMPERATURE (who is this ad targeting):
${tempList}

Ads:
${table}

Output ONLY a fenced JSON array, one object per ad, same order, nothing else:
\`\`\`json
[{"library_id": "...", "hook_angle": "...", "traffic_temperature": "..."}, ...]
\`\`\``,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return extractJson(text, response.stop_reason === "max_tokens") as {
    library_id: string;
    hook_angle: string | null;
    traffic_temperature: string | null;
  }[];
}

// Classifies every not-yet-classified ad for one competitor, capped at
// MAX_ADS_CLASSIFIED_PER_COMPETITOR. Deliberately NOT the regex cascade
// from the old seed script (HOOK_KEYWORDS/classifyHook) — that was ~100
// lines of hand-tuned PT-yoga-specific patterns (`/\bdarshan\b/`), exactly
// the per-niche manual tuning this fork exists to eliminate. An unexpected
// value from the model is written as null with a warning, not rejected —
// the DB has no CHECK constraint on these columns on purpose (see schema.sql).
export async function classifyAds(competitorId: string): Promise<number> {
  const sql = getSql();
  const cap = parseInt(process.env.MAX_ADS_CLASSIFIED_PER_COMPETITOR ?? "60", 10);

  const ads = (await sql`
    SELECT id, library_id, headline, body FROM ads
    WHERE competitor_id = ${competitorId} AND hook_angle IS NULL
    ORDER BY captured_at DESC
    LIMIT ${cap}
  `) as AdToClassify[];

  if (ads.length === 0) return 0;

  let classified = 0;
  for (const batch of chunk(ads, BATCH_SIZE)) {
    const verdicts = await classifyBatch(batch);
    const byLibraryId = new Map(verdicts.map((v) => [v.library_id, v]));

    for (const ad of batch) {
      const v = byLibraryId.get(ad.library_id);
      if (!v) continue;

      const hookAngle = isValidTaxonomyValue("HOOK_ANGLES", v.hook_angle) ? v.hook_angle : null;
      const trafficTemperature = isValidTaxonomyValue("TRAFFIC_TEMPERATURES", v.traffic_temperature)
        ? v.traffic_temperature
        : null;
      if (!hookAngle) console.warn(`classifyAds: unexpected hook_angle "${v.hook_angle}" for ad ${ad.id}`);
      if (!trafficTemperature)
        console.warn(`classifyAds: unexpected traffic_temperature "${v.traffic_temperature}" for ad ${ad.id}`);

      await sql`
        UPDATE ads SET hook_angle = ${hookAngle}, traffic_temperature = ${trafficTemperature}
        WHERE id = ${ad.id}
      `;
      classified++;
    }
  }
  return classified;
}

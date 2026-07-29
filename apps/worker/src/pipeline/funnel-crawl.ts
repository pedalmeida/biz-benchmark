import { Firecrawl } from "firecrawl";
import Anthropic from "@anthropic-ai/sdk";
import { FUNNEL_ROLES, OFFER_CATEGORIES, MAGNET_TYPES, isValidTaxonomyValue } from "@bb/shared";
import { getSql } from "../db.js";

const MODEL = "claude-sonnet-4-6";

// Strips tracking params so different ads pointing at "the same" page group
// together, and unwraps Facebook's click-redirector so the actual
// destination groups correctly too. Does NOT follow real HTTP redirects —
// Meta's Ad Library already resolves most landing_url values to the real
// destination before we ever see them, so the cost of an extra fetch per
// unique URL isn't buying much; this handles the one redirect shape that's
// resolvable without a network call.
export function normalizeLandingUrl(raw: string): string {
  try {
    let url = new URL(raw);
    if (url.hostname === "l.facebook.com" && url.pathname === "/l.php") {
      const inner = url.searchParams.get("u");
      if (inner) url = new URL(inner);
    }
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "fbclid") url.searchParams.delete(key);
    }
    url.hash = "";
    return url.toString();
  } catch {
    return raw;
  }
}

export async function getTopLandingUrls(competitorId: string, limit: number): Promise<string[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT landing_url FROM ads WHERE competitor_id = ${competitorId} AND landing_url IS NOT NULL
  `) as { landing_url: string }[];

  const counts = new Map<string, number>();
  for (const r of rows) {
    const normalized = normalizeLandingUrl(r.landing_url);
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([url]) => url);
}

type PageFetch = { url: string; markdown: string };

async function fetchPages(urls: string[]): Promise<PageFetch[]> {
  const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });
  const pages: PageFetch[] = [];
  for (const url of urls) {
    try {
      const result = await firecrawl.v1.scrapeUrl(url, { formats: ["markdown"], waitFor: 3000 });
      if (result.success && result.markdown) pages.push({ url, markdown: result.markdown });
    } catch {
      // one bad landing page shouldn't fail the whole competitor's funnel crawl
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return pages;
}

// Cheap, deterministic presence checks on the raw markdown — preferred over
// the LLM's answer when they disagree. LLMs are unreliable on binary
// presence questions; regex on the source text is not.
function detectBooleans(markdown: string) {
  return {
    has_email_capture: /type=["']?email["']?|<input[^>]*email/i.test(markdown),
    has_pricing: /[€$£]\s?\d|\d\s?(€|EUR|USD|\$)/i.test(markdown),
    has_quiz: /\bquiz\b|responda|answer these questions/i.test(markdown),
    has_testimonials: /testemunho|depoimento|testimonial|"{2,}.*"{2,}/i.test(markdown),
    has_video: /\.mp4|youtube\.com|vimeo\.com|<video/i.test(markdown),
  };
}

type ExtractedFunnelStep = {
  step_index: number;
  step_role: string | null;
  url: string;
  hero_headline: string | null;
  primary_cta: string | null;
  body_excerpt: string | null;
};
type ExtractedOffer = {
  name: string | null;
  url: string | null;
  category: string | null;
  price_actual: number | null;
  currency: string | null;
  guarantee: string | null;
  scarcity: string | null;
};
type ExtractedLeadMagnet = {
  magnet_type: string | null;
  title: string | null;
  url: string | null;
  promise: string | null;
};

function extractJson(text: string): unknown {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  return JSON.parse(match ? match[1] : text);
}

async function extractFunnel(
  pages: PageFetch[]
): Promise<{ steps: ExtractedFunnelStep[]; offers: ExtractedOffer[]; leadMagnets: ExtractedLeadMagnet[] }> {
  const roleList = FUNNEL_ROLES.map((r) => `${r.value}: ${r.description}`).join("\n");
  const categoryList = OFFER_CATEGORIES.map((c) => `${c.value}: ${c.description}`).join("\n");
  const magnetList = MAGNET_TYPES.map((m) => `${m.value}: ${m.description}`).join("\n");

  const pagesBlock = pages
    .map((p, i) => `## Page ${i + 1}: ${p.url}\n\n${p.markdown.slice(0, 6000)}`)
    .join("\n\n---\n\n");

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: `Below are the top landing page(s) this business's ads point to, in the order most-ads-point-here first. Extract the funnel structure.

FUNNEL STEP ROLES:
${roleList}

OFFER CATEGORIES:
${categoryList}

LEAD MAGNET TYPES:
${magnetList}

${pagesBlock}

Output ONLY a fenced JSON object, nothing else:
\`\`\`json
{
  "steps": [{"step_index": 1, "step_role": "...", "url": "...", "hero_headline": "...", "primary_cta": "...", "body_excerpt": "..."}],
  "offers": [{"name": "...", "url": "...", "category": "...", "price_actual": null, "currency": null, "guarantee": null, "scarcity": null}],
  "lead_magnets": [{"magnet_type": "...", "title": "...", "url": "...", "promise": "..."}]
}
\`\`\`
Omit offers/lead_magnets entirely (empty arrays) if the pages don't show any. Never invent a price you don't see on the page.`,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = extractJson(text) as {
    steps?: ExtractedFunnelStep[];
    offers?: ExtractedOffer[];
    lead_magnets?: ExtractedLeadMagnet[];
  };
  return { steps: parsed.steps ?? [], offers: parsed.offers ?? [], leadMagnets: parsed.lead_magnets ?? [] };
}

export async function crawlFunnel(competitorId: string, maxPages: number): Promise<number> {
  const urls = await getTopLandingUrls(competitorId, maxPages);
  if (urls.length === 0) return 0;

  const pages = await fetchPages(urls);
  if (pages.length === 0) return 0;

  const { steps, offers, leadMagnets } = await extractFunnel(pages);
  const sql = getSql();
  const capturedAt = new Date().toISOString().slice(0, 10);
  const funnelName = `${competitorId}-${capturedAt}`;

  for (const step of steps) {
    const page = pages.find((p) => p.url === step.url) ?? pages[0];
    const detected = detectBooleans(page.markdown);
    const stepRole = isValidTaxonomyValue("FUNNEL_ROLES", step.step_role) ? step.step_role : null;

    await sql`
      INSERT INTO funnel_steps (
        competitor_id, funnel_name, step_index, step_role, url,
        hero_headline, primary_cta, body_excerpt,
        has_email_capture, has_pricing, has_quiz, has_testimonials, has_video,
        captured_at
      ) VALUES (
        ${competitorId}, ${funnelName}, ${step.step_index}, ${stepRole}, ${step.url},
        ${step.hero_headline}, ${step.primary_cta}, ${step.body_excerpt},
        ${detected.has_email_capture}, ${detected.has_pricing}, ${detected.has_quiz},
        ${detected.has_testimonials}, ${detected.has_video},
        ${capturedAt}
      )
    `;
  }

  for (const offer of offers) {
    const category = isValidTaxonomyValue("OFFER_CATEGORIES", offer.category) ? offer.category : null;
    await sql`
      INSERT INTO offers (competitor_id, name, url, category, price_actual, currency, guarantee, scarcity, captured_at)
      VALUES (${competitorId}, ${offer.name}, ${offer.url}, ${category}, ${offer.price_actual}, ${offer.currency}, ${offer.guarantee}, ${offer.scarcity}, ${capturedAt})
    `;
  }

  for (const magnet of leadMagnets) {
    const magnetType = isValidTaxonomyValue("MAGNET_TYPES", magnet.magnet_type) ? magnet.magnet_type : null;
    await sql`
      INSERT INTO lead_magnets (competitor_id, magnet_type, title, url, promise, source_funnel, captured_at)
      VALUES (${competitorId}, ${magnetType}, ${magnet.title}, ${magnet.url}, ${magnet.promise}, ${funnelName}, ${capturedAt})
    `;
  }

  // The URL most ads point at is a reasonable guess at the primary site.
  try {
    const root = new URL(urls[0]).origin;
    await sql`UPDATE competitors SET primary_site_url = COALESCE(primary_site_url, ${root}) WHERE id = ${competitorId}`;
  } catch {
    // malformed URL, skip
  }

  return steps.length;
}

import { EVERGREEN_MIN_DAYS } from "@bb/shared";
import { getSql } from "./db.js";
import type { ParsedAd } from "./pipeline/parse-ad-library-md.js";

export type ScrapeJobStatus = "queued" | "running" | "partial" | "ok" | "failed";

export async function createScrapeJob(
  competitorId: string,
  trigger: string,
  runId: string
): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO scrape_jobs (competitor_id, trigger, sources, status, started_at, inngest_run_id)
    VALUES (${competitorId}, ${trigger}, ARRAY['meta_ad_library'], 'queued', NOW(), ${runId})
    RETURNING id
  `;
  return ((rows as { id: number }[])[0]).id;
}

export async function updateScrapeJob(
  jobId: number,
  status: ScrapeJobStatus,
  recordsAdded?: Record<string, number>,
  errors?: Record<string, string>
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE scrape_jobs
    SET
      status        = ${status},
      finished_at   = CASE WHEN ${status} IN ('ok', 'failed', 'partial') THEN NOW() ELSE finished_at END,
      records_added = ${recordsAdded ? JSON.stringify(recordsAdded) : null},
      errors        = ${errors ? JSON.stringify(errors) : null}
    WHERE id = ${jobId}
  `;
}

export async function upsertAds(
  competitorId: string,
  ads: ParsedAd[],
  country: string,
  capturedAt: string
): Promise<number> {
  const sql = getSql();
  let count = 0;
  for (const ad of ads) {
    const id = `${competitorId}-${ad.library_id}`;
    const durationDays = ad.started_at
      ? Math.max(
          0,
          Math.floor(
            (new Date(ad.ended_at ?? capturedAt).getTime() -
              new Date(ad.started_at).getTime()) /
              86400000
          )
        )
      : null;
    const isEvergreenWinner = (durationDays ?? 0) >= EVERGREEN_MIN_DAYS;

    await sql`
      INSERT INTO ads (
        id, competitor_id, platform, library_id, country, advertiser_page,
        advertiser_page_slug,
        started_at, ended_at, is_active, duration_days, creative_variants,
        is_evergreen_winner,
        headline, body, hashtags, cta, landing_url, creative_type,
        ad_library_url, raw_scrape_md, captured_at
      ) VALUES (
        ${id}, ${competitorId}, 'meta', ${ad.library_id}, ${country},
        ${ad.advertiser_page}, ${ad.advertiser_page_slug},
        ${ad.started_at}, ${ad.ended_at}, ${ad.is_active}, ${durationDays},
        ${ad.creative_variants}, ${isEvergreenWinner},
        ${ad.headline}, ${ad.body}, ${ad.hashtags}, ${ad.cta},
        ${ad.landing_url}, ${ad.creative_type},
        ${ad.ad_library_url}, ${ad.raw_block}, ${capturedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        is_active       = EXCLUDED.is_active,
        ended_at        = EXCLUDED.ended_at,
        duration_days   = EXCLUDED.duration_days,
        creative_variants = EXCLUDED.creative_variants,
        is_evergreen_winner = EXCLUDED.is_evergreen_winner,
        headline        = COALESCE(EXCLUDED.headline, ads.headline),
        body            = COALESCE(EXCLUDED.body, ads.body),
        cta             = COALESCE(EXCLUDED.cta, ads.cta),
        landing_url     = COALESCE(EXCLUDED.landing_url, ads.landing_url),
        raw_scrape_md   = EXCLUDED.raw_scrape_md,
        updated_at      = NOW()
    `;
    count++;
  }
  return count;
}

// ============================================================
// RUNS (a niche+country benchmark request)
// ============================================================

export type Run = {
  id: string;
  niche_label: string;
  niche_key: string;
  country: string;
  language: string | null;
  keywords: string[] | null;
  discovery_method: string | null;
  status: string;
  cost_cents: number;
  error: string | null;
};

export function normalizeNicheKey(nicheLabel: string): string {
  return nicheLabel
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function makeRunId(nicheLabel: string, country: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${normalizeNicheKey(nicheLabel)}-${country.toLowerCase()}-${date}`;
}

// A run `ready` within RUN_CACHE_DAYS for the same niche+country is reused
// instead of re-discovering — the biggest single cost lever once this is
// public: the Nth person asking about the same niche costs nothing extra.
export async function findCachedRun(
  nicheKey: string,
  country: string,
  cacheDays: number
): Promise<Run | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, niche_label, niche_key, country, language, keywords,
           discovery_method, status, cost_cents, error
    FROM runs
    WHERE niche_key = ${nicheKey}
      AND country = ${country}
      AND status = 'ready'
      AND finished_at > NOW() - (${cacheDays} || ' days')::interval
    ORDER BY finished_at DESC
    LIMIT 1
  `;
  return ((rows as Run[])[0]) ?? null;
}

export async function createRun(
  id: string,
  nicheLabel: string,
  nicheKey: string,
  country: string
): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO runs (id, niche_label, niche_key, country, status, started_at)
    VALUES (${id}, ${nicheLabel}, ${nicheKey}, ${country}, 'discovering', NOW())
  `;
}

export async function updateRun(
  id: string,
  patch: {
    status?: string;
    keywords?: string[];
    language?: string;
    discovery_method?: string;
    error?: string;
    cost_cents?: number;
    finished?: boolean;
  }
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE runs
    SET
      status           = COALESCE(${patch.status ?? null}, status),
      keywords         = COALESCE(${patch.keywords ?? null}, keywords),
      language         = COALESCE(${patch.language ?? null}, language),
      discovery_method = COALESCE(${patch.discovery_method ?? null}, discovery_method),
      error            = COALESCE(${patch.error ?? null}, error),
      cost_cents       = COALESCE(${patch.cost_cents ?? null}, cost_cents),
      finished_at      = CASE WHEN ${patch.finished ?? false} THEN NOW() ELSE finished_at END
    WHERE id = ${id}
  `;
}

// ============================================================
// DISCOVERY_CANDIDATES (the filter's audit trail)
// ============================================================

export async function insertDiscoveryCandidates(
  runId: string,
  candidates: {
    pageId: string | null;
    pageSlug: string | null;
    pageName: string;
    nameKey: string;
    adCount: number;
    currencies: string[];
    sampleBodies: string[];
    verdict: string;
  }[]
): Promise<void> {
  const sql = getSql();
  for (const c of candidates) {
    await sql`
      INSERT INTO discovery_candidates (
        run_id, page_id, page_slug, page_name, name_key,
        ad_count, currencies, sample_bodies, verdict
      ) VALUES (
        ${runId}, ${c.pageId}, ${c.pageSlug}, ${c.pageName}, ${c.nameKey},
        ${c.adCount}, ${c.currencies}, ${c.sampleBodies}, ${c.verdict}
      )
      ON CONFLICT (run_id, name_key) DO UPDATE SET
        ad_count = EXCLUDED.ad_count,
        verdict  = EXCLUDED.verdict
    `;
  }
}

// ============================================================
// AUTO-CREATED COMPETITORS + RUN_COMPETITORS
// ============================================================

// Mirrors apps/admin/lib/queries.ts createCompetitor, ported here because
// the run pipeline (and therefore competitor auto-creation) lives in the
// worker, not the admin app. Idempotent on meta_page_slug so re-running the
// same niche doesn't create duplicate rows for the same business.
export async function upsertAutoCompetitor(input: {
  id: string;
  name: string;
  metaPageId: string | null;
  metaPageSlug: string | null;
  businessType: string | null;
  hqCountry: string;
}): Promise<string> {
  const sql = getSql();
  const existing = (input.metaPageSlug
    ? await sql`SELECT id FROM competitors WHERE meta_page_slug = ${input.metaPageSlug} LIMIT 1`
    : []) as { id: string }[];
  if (existing.length > 0) return existing[0].id;

  await sql`
    INSERT INTO competitors (
      id, name, status, hq_country, meta_page_id, meta_page_slug,
      business_type, source
    ) VALUES (
      ${input.id}, ${input.name}, 'wip', ${input.hqCountry},
      ${input.metaPageId}, ${input.metaPageSlug}, ${input.businessType}, 'auto'
    )
    ON CONFLICT (id) DO NOTHING
  `;
  return input.id;
}

export async function insertRunCompetitors(
  runId: string,
  rows: {
    competitorId: string;
    discoveredVia: string;
    relevanceScore: number | null;
    relevanceReason: string | null;
    included: boolean;
    rank: number | null;
  }[]
): Promise<void> {
  const sql = getSql();
  for (const r of rows) {
    await sql`
      INSERT INTO run_competitors (
        run_id, competitor_id, discovered_via, relevance_score,
        relevance_reason, included, rank
      ) VALUES (
        ${runId}, ${r.competitorId}, ${r.discoveredVia}, ${r.relevanceScore},
        ${r.relevanceReason}, ${r.included}, ${r.rank}
      )
      ON CONFLICT (run_id, competitor_id) DO UPDATE SET
        relevance_score  = EXCLUDED.relevance_score,
        relevance_reason = EXCLUDED.relevance_reason,
        included         = EXCLUDED.included,
        rank             = EXCLUDED.rank
    `;
  }
}

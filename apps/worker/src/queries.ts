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

    await sql`
      INSERT INTO ads (
        id, competitor_id, platform, library_id, country, advertiser_page,
        started_at, ended_at, is_active, duration_days, creative_variants,
        headline, body, hashtags, cta, landing_url, creative_type,
        ad_library_url, raw_scrape_md, captured_at
      ) VALUES (
        ${id}, ${competitorId}, 'meta', ${ad.library_id}, ${country},
        ${ad.advertiser_page},
        ${ad.started_at}, ${ad.ended_at}, ${ad.is_active}, ${durationDays},
        ${ad.creative_variants},
        ${ad.headline}, ${ad.body}, ${ad.hashtags}, ${ad.cta},
        ${ad.landing_url}, ${ad.creative_type},
        ${ad.ad_library_url}, ${ad.raw_block}, ${capturedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        is_active       = EXCLUDED.is_active,
        ended_at        = EXCLUDED.ended_at,
        duration_days   = EXCLUDED.duration_days,
        creative_variants = EXCLUDED.creative_variants,
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

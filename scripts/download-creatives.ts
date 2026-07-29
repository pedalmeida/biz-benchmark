#!/usr/bin/env tsx
/**
 * download-creatives.ts
 *
 * For each ad, extract the best FB CDN URL from raw_scrape_md and
 * download it to data/assets/<competitor>/<library_id>.jpg.
 * Insert/update an ad_assets row.
 *
 * Preference order (best → fallback):
 *   1. dst-jpg_s600x600  — actual ad creative
 *   2. dst-jpg_s60x60    — page profile thumbnail (fallback)
 *
 * FB CDN URLs expire ~24-48h after the scrape — re-run after each
 * weekly Inngest scrape to refresh.
 *
 * Idempotent: skips files that already exist on disk unless --force.
 */

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..");
config({ path: join(REPO_ROOT, ".env.local") });

const sql = neon(process.env.DATABASE_URL!);

const ASSETS_DIR = join(REPO_ROOT, "data/assets");
const FORCE = process.argv.includes("--force");

type AdRow = {
  id: string;
  competitor_id: string;
  library_id: string;
  raw_scrape_md: string | null;
};

type AssetRecord = {
  ad_id: string;
  asset_type: string;
  storage_path: string;
  source_url: string;
  bytes: number;
};

function extractBestUrl(md: string): { url: string; quality: "creative" | "thumb" } | null {
  // Prefer the 600x600 creative
  const creative = md.match(/https:\/\/scontent[^"\s)]+dst-jpg_s600x600[^"\s)]+/);
  if (creative) return { url: creative[0], quality: "creative" };
  // Fallback to 60x60 page thumbnail
  const thumb = md.match(/https:\/\/scontent[^"\s)]+dst-jpg_s60x60[^"\s)]+/);
  if (thumb) return { url: thumb[0], quality: "thumb" };
  return null;
}

async function downloadOne(url: string, dest: string): Promise<number | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  HTTP ${res.status} for ${url.slice(0, 80)}…`);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) {
      console.error(`  Suspiciously small (${buf.length} B), skipping`);
      return null;
    }
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, buf);
    return buf.length;
  } catch (e) {
    console.error(`  fetch error: ${(e as Error).message}`);
    return null;
  }
}

async function main() {
  console.log(`[download] assets dir: ${ASSETS_DIR}`);
  console.log(`[download] force redownload: ${FORCE}`);
  console.log("");

  const ads = (await sql`
    SELECT id, competitor_id, library_id, raw_scrape_md
    FROM ads
    WHERE raw_scrape_md IS NOT NULL
    ORDER BY competitor_id, library_id
  `) as unknown as AdRow[];

  console.log(`[download] ${ads.length} ads to process`);
  console.log("");

  let okCreative = 0;
  let okThumb = 0;
  let skipped = 0;
  let failed = 0;
  let noUrl = 0;

  const inserts: AssetRecord[] = [];

  for (const ad of ads) {
    const best = extractBestUrl(ad.raw_scrape_md || "");
    if (!best) {
      noUrl++;
      continue;
    }

    const ext = "jpg";
    const filename = `${ad.library_id}.${ext}`;
    const relPath = `assets/${ad.competitor_id}/${filename}`;
    const absPath = join(ASSETS_DIR, ad.competitor_id, filename);

    if (!FORCE && existsSync(absPath)) {
      const s = statSync(absPath);
      if (s.size > 200) {
        skipped++;
        inserts.push({
          ad_id: ad.id,
          asset_type: best.quality === "creative" ? "creative-image" : "creative-thumb",
          storage_path: relPath,
          source_url: best.url,
          bytes: s.size,
        });
        continue;
      }
    }

    const bytes = await downloadOne(best.url, absPath);
    if (bytes == null) {
      failed++;
      continue;
    }
    if (best.quality === "creative") okCreative++;
    else okThumb++;

    inserts.push({
      ad_id: ad.id,
      asset_type: best.quality === "creative" ? "creative-image" : "creative-thumb",
      storage_path: relPath,
      source_url: best.url,
      bytes,
    });
  }

  console.log("");
  console.log(`[download] downloaded: ${okCreative} creatives + ${okThumb} thumbs`);
  console.log(`[download] skipped (already on disk): ${skipped}`);
  console.log(`[download] failed: ${failed}`);
  console.log(`[download] no extractable URL: ${noUrl}`);
  console.log("");

  // Wipe existing ad_assets rows for these ads then re-insert
  console.log("[download] refreshing ad_assets table...");
  const adIds = Array.from(new Set(inserts.map((r) => r.ad_id)));
  if (adIds.length > 0) {
    await sql`DELETE FROM ad_assets WHERE ad_id = ANY(${adIds as any})`;
  }

  for (const r of inserts) {
    await sql`
      INSERT INTO ad_assets (ad_id, asset_type, storage_path, source_url, downloaded_at, bytes)
      VALUES (${r.ad_id}, ${r.asset_type}, ${r.storage_path}, ${r.source_url}, NOW(), ${r.bytes})
    `;
  }

  console.log(`[download] ad_assets: ${inserts.length} rows total`);

  // Summary by competitor
  console.log("");
  console.log("--- Per-competitor coverage ---");
  const summary = (await sql`
    SELECT c.id,
           COUNT(DISTINCT a.id) AS ads,
           COUNT(DISTINCT aa.ad_id) AS with_asset,
           COUNT(DISTINCT aa.ad_id) FILTER (WHERE aa.asset_type='creative-image') AS with_creative,
           COUNT(DISTINCT aa.ad_id) FILTER (WHERE aa.asset_type='creative-thumb') AS with_thumb_only
    FROM competitors c
    LEFT JOIN ads a ON a.competitor_id = c.id
    LEFT JOIN ad_assets aa ON aa.ad_id = a.id
    GROUP BY c.id
    ORDER BY c.id
  `) as Array<{ id: string; ads: string; with_asset: string; with_creative: string; with_thumb_only: string }>;

  for (const s of summary) {
    console.log(
      `  ${s.id.padEnd(32)} ${String(s.ads).padStart(3)} ads | ` +
      `${String(s.with_asset).padStart(3)} with asset | ` +
      `${String(s.with_creative).padStart(3)} creatives | ` +
      `${String(s.with_thumb_only).padStart(3)} thumb-only`
    );
  }
}

main().catch((e) => {
  console.error("[download] FAILED:", e);
  process.exit(1);
});

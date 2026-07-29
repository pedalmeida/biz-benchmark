import { Firecrawl } from "firecrawl";
import { parseAdLibraryMarkdown } from "./pipeline/parse-ad-library-md.js";
import { upsertAds } from "./queries.js";

export async function scrapeAdLibrary(opts: {
  competitorId: string;
  pageHandle: string;
  country?: string;
}): Promise<{ adsUpserted: number; error?: string }> {
  const country = opts.country ?? "PT";
  const url =
    `https://www.facebook.com/ads/library/?active_status=all` +
    `&ad_type=all&country=${country}` +
    `&q=${encodeURIComponent(opts.pageHandle)}` +
    `&search_type=keyword_unordered`;

  const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });
  const result = await firecrawl.v1.scrapeUrl(url, {
    formats: ["markdown"],
    waitFor: 4000,
  });

  if (!result.success || !result.markdown) {
    return {
      adsUpserted: 0,
      error: `Firecrawl failed: ${(result as { error?: string }).error ?? "no markdown"}`,
    };
  }

  const parsed = parseAdLibraryMarkdown(result.markdown);
  if (parsed.length === 0) {
    return {
      adsUpserted: 0,
      error: "Parser found 0 ads — page may have no ads or structure changed.",
    };
  }

  const capturedAt = new Date().toISOString().slice(0, 10);
  const adsUpserted = await upsertAds(opts.competitorId, parsed, country, capturedAt);
  return { adsUpserted };
}

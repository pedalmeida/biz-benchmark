import { normalizeNameKey } from "@bb/shared";
import { fetchAdLibraryMarkdown } from "./pipeline/fetch-ad-library.js";
import { upsertAds } from "./queries.js";

export async function scrapeAdLibrary(opts: {
  competitorId: string;
  pageHandle: string;
  country?: string;
  // The page slug discovery already confirmed for this competitor, when
  // known. `fetchAdLibraryMarkdown` is a KEYWORD search, not an exact-page
  // lookup — a short or generic pageHandle (e.g. "HeyDoc") can match
  // completely unrelated advertisers (mobile games, drama-serial apps,
  // supplement pages were all observed matching real page-name searches
  // during testing). Without this filter every one of those gets silently
  // attributed to the wrong competitor.
  expectedPageSlug?: string | null;
}): Promise<{ adsUpserted: number; error?: string; skippedOtherAdvertisers?: number }> {
  const country = opts.country ?? "PT";
  const { ads: rawAds, error } = await fetchAdLibraryMarkdown(opts.pageHandle, country);
  if (error) return { adsUpserted: 0, error };

  const expectedKey = opts.expectedPageSlug ?? normalizeNameKey(opts.pageHandle);
  const ads = rawAds.filter((ad) => {
    const key = ad.advertiser_page_slug ?? (ad.advertiser_page ? normalizeNameKey(ad.advertiser_page) : null);
    return key === expectedKey;
  });
  const skippedOtherAdvertisers = rawAds.length - ads.length;

  if (ads.length === 0) {
    return {
      adsUpserted: 0,
      skippedOtherAdvertisers,
      error: `All ${rawAds.length} result(s) for "${opts.pageHandle}" belonged to other advertisers — none matched.`,
    };
  }

  const capturedAt = new Date().toISOString().slice(0, 10);
  const adsUpserted = await upsertAds(opts.competitorId, ads, country, capturedAt);
  return { adsUpserted, skippedOtherAdvertisers };
}

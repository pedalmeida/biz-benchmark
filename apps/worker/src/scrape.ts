import { fetchAdLibraryMarkdown } from "./pipeline/fetch-ad-library.js";
import { upsertAds } from "./queries.js";

export async function scrapeAdLibrary(opts: {
  competitorId: string;
  pageHandle: string;
  country?: string;
}): Promise<{ adsUpserted: number; error?: string }> {
  const country = opts.country ?? "PT";
  const { ads, error } = await fetchAdLibraryMarkdown(opts.pageHandle, country);
  if (error) return { adsUpserted: 0, error };

  const capturedAt = new Date().toISOString().slice(0, 10);
  const adsUpserted = await upsertAds(opts.competitorId, ads, country, capturedAt);
  return { adsUpserted };
}

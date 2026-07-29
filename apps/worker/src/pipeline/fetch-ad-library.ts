import { Firecrawl } from "firecrawl";
import { parseAdLibraryMarkdown, type ParsedAd } from "./parse-ad-library-md.js";

export type AdLibraryFetchResult = {
  ads: ParsedAd[];
  error?: string;
};

// Shared by the per-competitor deep scrape (scrape.ts) and the discovery
// pipeline (discovery.ts) — both are the same underlying operation, a
// keyword search of the public Meta Ad Library via Firecrawl.
export async function fetchAdLibraryMarkdown(
  query: string,
  country: string
): Promise<AdLibraryFetchResult> {
  const url =
    `https://www.facebook.com/ads/library/?active_status=all` +
    `&ad_type=all&country=${country}` +
    `&q=${encodeURIComponent(query)}` +
    `&search_type=keyword_unordered`;

  const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });
  let result: Awaited<ReturnType<typeof firecrawl.v1.scrapeUrl>>;
  try {
    result = await firecrawl.v1.scrapeUrl(url, {
      formats: ["markdown"],
      waitFor: 4000,
    });
  } catch (err) {
    // The SDK throws on transport-level failures (e.g. a 408 timeout)
    // rather than returning {success: false} — normalize both shapes so
    // callers (a discovery loop over several keywords, in particular)
    // never have to try/catch this themselves.
    return { ads: [], error: `Firecrawl threw: ${String(err)}` };
  }

  if (!result.success || !result.markdown) {
    return {
      ads: [],
      // Meta serving a login wall and "genuinely no ads" both currently
      // produce this same shape — see raw markdown capture in discovery.ts
      // and scrape.ts callers for how the raw response is preserved for
      // diagnosis.
      error: `Firecrawl failed: ${(result as { error?: string }).error ?? "no markdown"}`,
    };
  }

  const ads = parseAdLibraryMarkdown(result.markdown);
  if (ads.length === 0) {
    return { ads: [], error: "Parser found 0 ads — page may have no ads or structure changed." };
  }

  return { ads };
}

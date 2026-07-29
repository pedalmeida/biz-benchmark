export type ParsedAd = {
  library_id: string;
  advertiser_page: string | null;
  advertiser_page_slug: string | null;
  is_active: boolean;
  started_at: string | null;
  ended_at: string | null;
  headline: string | null;
  body: string | null;
  hashtags: string[];
  cta: string | null;
  landing_url: string | null;
  creative_type: string | null;
  creative_variants: number;
  ad_library_url: string;
  raw_block: string;
};

const MONTH_MAP: Record<string, string> = {
  january: "01", jan: "01",
  february: "02", feb: "02",
  march: "03", mar: "03",
  april: "04", apr: "04",
  may: "05",
  june: "06", jun: "06",
  july: "07", jul: "07",
  august: "08", aug: "08",
  september: "09", sep: "09",
  october: "10", oct: "10",
  november: "11", nov: "11",
  december: "12", dec: "12",
};

function parseEnglishDate(month: string, day: string, year: string): string | null {
  const m = MONTH_MAP[month.toLowerCase()];
  if (!m) return null;
  return `${year}-${m}-${day.padStart(2, "0")}`;
}

export function parseAdLibraryMarkdown(text: string): ParsedAd[] {
  const ads: ParsedAd[] = [];

  // Split on Library ID markers — both PT and EN formats
  const idRegex = /(?:Library ID|Identificação da biblioteca):\s*(\d+)/g;
  const matches = [...text.matchAll(idRegex)];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index!;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const chunk = text.slice(start, end);
    const library_id = matches[i][1];
    const ad_library_url = `https://www.facebook.com/ads/library/?id=${library_id}`;

    // --- Dates ---
    let started_at: string | null = null;
    let ended_at: string | null = null;
    let is_active = false;

    // PT range: "DD/MM/YYYY – DD/MM/YYYY"
    const ptRange = chunk.match(/(\d{2})\/(\d{2})\/(\d{4})\s*[–-]\s*(\d{2})\/(\d{2})\/(\d{4})/);
    if (ptRange) {
      started_at = `${ptRange[3]}-${ptRange[2]}-${ptRange[1]}`;
      ended_at = `${ptRange[6]}-${ptRange[5]}-${ptRange[4]}`;
    } else {
      // PT active: "Começou a ser publicado a DD/MM/YYYY"
      const ptActive = chunk.match(/Come[çc]ou a ser publicado a (\d{2})\/(\d{2})\/(\d{4})/);
      if (ptActive) {
        started_at = `${ptActive[3]}-${ptActive[2]}-${ptActive[1]}`;
        is_active = true;
      } else {
        // EN active: "Started running on May 14, 2026"
        const enActive = chunk.match(/Started running on ([A-Za-z]+) (\d{1,2}),\s*(\d{4})/);
        if (enActive) {
          started_at = parseEnglishDate(enActive[1], enActive[2], enActive[3]);
          is_active = true;
        } else {
          // EN range: "Mar 22, 2025 - Apr 5, 2025"
          const enRange = chunk.match(
            /([A-Za-z]+) (\d{1,2}),\s*(\d{4})\s*[–-]\s*([A-Za-z]+) (\d{1,2}),\s*(\d{4})/
          );
          if (enRange) {
            started_at = parseEnglishDate(enRange[1], enRange[2], enRange[3]);
            ended_at = parseEnglishDate(enRange[4], enRange[5], enRange[6]);
          }
        }
      }
    }

    if ((chunk.match(/\bAtivo\b/) || chunk.match(/\bActive\b/)) && !ended_at) {
      is_active = true;
    }

    // Skip ads with no parseable dates
    if (!started_at && !ended_at) continue;

    // --- Creative variants ---
    let creative_variants = 1;
    const variantsPt = chunk.match(/\*\*(\d+)\s+an[úu]ncios\*\*\s+utilizam/i);
    const variantsEn = chunk.match(/\*\*(\d+)\s+ads\*\*\s+use this creative/i);
    if (variantsPt) creative_variants = parseInt(variantsPt[1], 10);
    else if (variantsEn) creative_variants = parseInt(variantsEn[1], 10);

    // --- Advertiser page ---
    // Captures both the display name (group 1) and the page slug (group 2) —
    // the slug is a far more stable dedupe key across ads than a display name,
    // which can vary in casing/punctuation for the same page.
    const advMatch = chunk.match(/\[([^\]]+)\]\(https:\/\/www\.facebook\.com\/([^/)]+)\/?\)/);
    const advertiser_page = advMatch ? advMatch[1] : null;
    const advertiser_page_slug = advMatch ? advMatch[2] : null;

    // --- Body (between "Patrocinado"/"Sponsored" and next link/CTA) ---
    let body = "";
    const sponsoredIdx = chunk.search(/\*\*(Patrocinado|Sponsored)\*\*/);
    if (sponsoredIdx >= 0) {
      const afterSponsored = chunk.slice(sponsoredIdx);
      const afterMarker = afterSponsored.replace(/\*\*(Patrocinado|Sponsored)\*\*\s*/, "");
      const stopIdx = afterMarker.search(
        /(Infelizmente, estamos a ter problemas|Sorry, we're having trouble|\[!\[|\[Saber mais\]|\[Learn more\]|^\s*\*\s*\*\s*\*)/m
      );
      body = stopIdx >= 0 ? afterMarker.slice(0, stopIdx).trim() : afterMarker.trim();
    }

    // Headline = first non-empty line of body
    const headline =
      body
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.length > 0) ?? null;

    // Hashtags
    const hashtags = [...body.matchAll(/#([A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]+)/g)].map((m) => m[1]);

    // --- CTA + landing_url ---
    let cta: string | null = null;
    let landing_url: string | null = null;
    const ctaMatch = chunk.match(
      /\[(Saber mais|Learn More|Sign Up|Registar|See details|Buy tickets|Doar agora|Donate now|Reservar agora)\]\((https?:\/\/[^)]+)\)/i
    );
    if (ctaMatch) {
      cta = ctaMatch[1];
      landing_url = ctaMatch[2];
    } else {
      const urlMatch = chunk.match(/\(http[^)]+\)/);
      if (urlMatch) landing_url = urlMatch[0].slice(1, -1);
    }

    // --- Creative type ---
    const creative_type = /\[\!\[\]\(/.test(chunk)
      ? "image"
      : /Infelizmente|Sorry, we're having/.test(chunk)
      ? "video"
      : "image";

    ads.push({
      library_id,
      advertiser_page,
      advertiser_page_slug,
      is_active: ended_at ? false : is_active,
      started_at,
      ended_at,
      headline: headline ? headline.slice(0, 500) : null,
      body: body ? body.slice(0, 4000) : null,
      hashtags,
      cta,
      landing_url,
      creative_type,
      creative_variants,
      ad_library_url,
      raw_block: chunk.slice(0, 5000),
    });
  }

  return ads;
}

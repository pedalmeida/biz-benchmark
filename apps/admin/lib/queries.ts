import { getSql } from "@/lib/db";

export type Competitor = {
  id: string;
  name: string;
  status: string;
  hq_country: string | null;
  hq_city: string | null;
  org_type: string | null;
  business_type?: string | null;
  org_size_estimate: string | null;
  archetype: string | null;
  voice_descriptor: string | null;
  audience_target: string | null;
  one_line_summary: string | null;
  ad_strategy: string | null;
  value_ladder: ValueLadderRung[] | null;
  primary_site_url: string | null;
  last_refreshed_at: string | null;
  founder?: string | null;
  founder_alive?: boolean | null;
  attractive_character_name?: string | null;
  attractive_character_alive?: boolean | null;
  positioning_notes?: string | null;
  funnel_archetype?: string | null;
  // Computed stats
  ad_count?: number;
  active_count?: number;
  evergreen_count?: number;
  longest_run_days?: number | null;
};

export type ValueLadderRung = {
  rung: string;
  offer: string;
  price: string | number | null;
  type: string;
  url?: string | null;
  description?: string | null;
};

export type Ad = {
  id: string;
  competitor_id: string;
  platform: string;
  library_id: string;
  country: string;
  advertiser_page?: string | null;
  started_at: string | null;
  ended_at: string | null;
  is_active: boolean | null;
  duration_days: number | null;
  creative_variants?: number | null;
  is_evergreen_winner: boolean | null;
  hook_angle: string | null;
  traffic_temperature: string | null;
  headline: string | null;
  body: string | null;
  cta: string | null;
  landing_url: string | null;
  creative_type: string | null;
  ad_library_url: string | null;
};

export type HookCount = { angle: string; count: number };
export type TempCount = { temperature: string; count: number };
export type StrategyCount = { strategy: string; count: number };
export type EvergreenWinner = {
  duration_days: number;
  competitor_id: string;
  library_id: string;
  headline: string | null;
};

export type PatternsData = {
  evergreen_winners_top_20: EvergreenWinner[];
  hooks_global: HookCount[];
  strategies_count: StrategyCount[];
};

export async function listCompetitors(): Promise<Competitor[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      c.id, c.name, c.status, c.hq_country, c.org_type, c.org_size_estimate,
      c.archetype, c.voice_descriptor, c.audience_target, c.one_line_summary,
      c.ad_strategy, c.value_ladder, c.primary_site_url,
      c.last_refreshed_at::text,
      COUNT(a.id)::int                                       AS ad_count,
      COUNT(a.id) FILTER (WHERE a.is_active = true)::int     AS active_count,
      COUNT(a.id) FILTER (WHERE a.is_evergreen_winner = true)::int AS evergreen_count,
      MAX(a.duration_days)::int                              AS longest_run_days
    FROM competitors c
    LEFT JOIN ads a ON a.competitor_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `;
  return rows as Competitor[];
}

export async function createCompetitor(input: {
  id: string;
  name: string;
  primary_site_url?: string | null;
  hq_country?: string | null;
  org_type?: string | null;
  one_line_summary?: string | null;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO competitors (id, name, primary_site_url, hq_country, org_type, one_line_summary, status)
    VALUES (
      ${input.id}, ${input.name}, ${input.primary_site_url ?? null},
      ${input.hq_country ?? null}, ${input.org_type ?? null},
      ${input.one_line_summary ?? null}, 'wip'
    )
  `;
}

export async function getCompetitor(id: string): Promise<Competitor | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      c.id, c.name, c.status, c.hq_country, c.hq_city, c.org_type, c.org_size_estimate,
      c.archetype, c.voice_descriptor, c.audience_target,
      c.positioning_notes, c.one_line_summary, c.ad_strategy,
      c.value_ladder, c.primary_site_url, c.founder, c.founder_alive,
      c.attractive_character_name, c.attractive_character_alive, c.funnel_archetype,
      c.last_refreshed_at::text,
      COUNT(a.id)::int                                       AS ad_count,
      COUNT(a.id) FILTER (WHERE a.is_active = true)::int     AS active_count,
      COUNT(a.id) FILTER (WHERE a.is_evergreen_winner = true)::int AS evergreen_count,
      MAX(a.duration_days)::int                              AS longest_run_days
    FROM competitors c
    LEFT JOIN ads a ON a.competitor_id = c.id
    WHERE c.id = ${id}
    GROUP BY c.id
  `;
  return (rows[0] as Competitor) ?? null;
}

export async function listAds(competitorId: string): Promise<Ad[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      id, competitor_id, platform, library_id, country,
      started_at::text, ended_at::text, is_active, duration_days, creative_variants,
      is_evergreen_winner, hook_angle, traffic_temperature,
      headline, body, cta, landing_url, creative_type, ad_library_url
    FROM ads
    WHERE competitor_id = ${competitorId}
    ORDER BY duration_days DESC NULLS LAST, started_at DESC NULLS LAST, id
  `;
  return rows as Ad[];
}

// ============================================================
// INTEL SOURCES (social handles, follower counts, etc.)
// ============================================================

export type IntelSource = {
  id: number;
  competitor_id: string;
  source_type: string;            // instagram | youtube_channel | facebook | tiktok | linkedin_company | website | ...
  url: string;
  handle: string | null;
  display_name: string | null;
  follower_count: number | null;
  is_canonical: boolean;
  verified_at: string | null;
};

/** All intel sources for a competitor, canonical-first then by follower count. */
export async function listIntelSources(competitorId: string): Promise<IntelSource[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      id, competitor_id, source_type, url, handle, display_name, follower_count,
      is_canonical, verified_at::text
    FROM intel_sources
    WHERE competitor_id = ${competitorId}
    ORDER BY is_canonical DESC, follower_count DESC NULLS LAST, source_type
  `;
  return rows as IntelSource[];
}

/** Intel sources for many competitors at once — for the dashboard grid. */
export async function listIntelSourcesByCompetitors(
  competitorIds: string[],
): Promise<Map<string, IntelSource[]>> {
  if (competitorIds.length === 0) return new Map();
  const sql = getSql();
  const rows = (await sql`
    SELECT
      id, competitor_id, source_type, url, handle, display_name, follower_count,
      is_canonical, verified_at::text
    FROM intel_sources
    WHERE competitor_id = ANY(${competitorIds})
    ORDER BY is_canonical DESC, follower_count DESC NULLS LAST, source_type
  `) as IntelSource[];

  const map = new Map<string, IntelSource[]>();
  for (const r of rows) {
    const arr = map.get(r.competitor_id);
    if (arr) arr.push(r);
    else map.set(r.competitor_id, [r]);
  }
  return map;
}

/** Top N ads for a competitor, prioritising evergreen winners then longest-running. */
export async function getTopAdsForCompetitor(
  competitorId: string,
  limit: number = 6,
): Promise<Ad[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      id, competitor_id, platform, library_id, country,
      started_at::text, ended_at::text, is_active, duration_days, creative_variants,
      is_evergreen_winner, hook_angle, traffic_temperature,
      headline, body, cta, landing_url, creative_type, ad_library_url
    FROM ads
    WHERE competitor_id = ${competitorId}
    ORDER BY
      is_evergreen_winner DESC NULLS LAST,
      duration_days DESC NULLS LAST,
      started_at DESC NULLS LAST
    LIMIT ${limit}
  `;
  return rows as Ad[];
}

export async function listAllAds(): Promise<Ad[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      id, competitor_id, platform, library_id, country, advertiser_page,
      started_at::text, ended_at::text, is_active, duration_days, creative_variants,
      is_evergreen_winner, hook_angle, traffic_temperature,
      headline, body, cta, landing_url, creative_type, ad_library_url
    FROM ads
    ORDER BY duration_days DESC NULLS LAST, started_at DESC NULLS LAST, id
  `;
  return rows as Ad[];
}

export async function getCompetitorHookCounts(id: string): Promise<HookCount[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT hook_angle AS angle, COUNT(*)::int AS count
    FROM ads
    WHERE competitor_id = ${id} AND hook_angle IS NOT NULL
    GROUP BY hook_angle
    ORDER BY count DESC
  `;
  return rows as HookCount[];
}

export async function getCompetitorTempCounts(id: string): Promise<TempCount[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT traffic_temperature AS temperature, COUNT(*)::int AS count
    FROM ads
    WHERE competitor_id = ${id} AND traffic_temperature IS NOT NULL
    GROUP BY traffic_temperature
    ORDER BY count DESC
  `;
  return rows as TempCount[];
}

export async function getPatternsData(): Promise<PatternsData> {
  const sql = getSql();
  const [evergreen, hooks, strategies] = await Promise.all([
    sql`
      SELECT duration_days, competitor_id, library_id, headline
      FROM ads
      WHERE is_evergreen_winner = true AND duration_days IS NOT NULL
      ORDER BY duration_days DESC
      LIMIT 20
    `,
    sql`
      SELECT hook_angle AS angle, COUNT(*)::int AS count
      FROM ads
      WHERE hook_angle IS NOT NULL
      GROUP BY hook_angle
      ORDER BY count DESC
    `,
    sql`
      SELECT ad_strategy AS strategy, COUNT(*)::int AS count
      FROM competitors
      WHERE ad_strategy IS NOT NULL
      GROUP BY ad_strategy
      ORDER BY count DESC
    `,
  ]);

  return {
    evergreen_winners_top_20: evergreen as EvergreenWinner[],
    hooks_global: hooks as HookCount[],
    strategies_count: strategies as StrategyCount[],
  };
}

// ============================================================
// SCRAPE JOBS
// ============================================================

export type ScrapeJobStatus = "queued" | "running" | "partial" | "ok" | "failed";

export type ScrapeJob = {
  id: number;
  competitor_id: string;
  trigger: string;
  sources: string[];
  status: ScrapeJobStatus;
  started_at: string | null;
  finished_at: string | null;
  records_added: Record<string, number> | null;
  errors: Record<string, string> | null;
  inngest_run_id: string | null;
};

export async function getLatestScrapeJob(competitorId: string): Promise<ScrapeJob | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM scrape_jobs
    WHERE competitor_id = ${competitorId}
    ORDER BY started_at DESC NULLS LAST
    LIMIT 1
  `;
  return (rows[0] as ScrapeJob) ?? null;
}

// ============================================================
// ANALYSES (framework-driven strategic reports)
// ============================================================

export type Analysis = {
  id: number;
  competitor_id: string;
  framework: string;
  scope: string | null;
  scope_ref: string | null;
  markdown: string;
  scores: Record<string, number> | null;
  generated_by: string | null;
  generated_at: string;
};

export async function listAnalyses(competitorId: string): Promise<Analysis[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      id, competitor_id, framework, scope, scope_ref,
      markdown, scores, generated_by, generated_at::text
    FROM analyses
    WHERE competitor_id = ${competitorId}
    ORDER BY generated_at DESC
  `;
  return rows as Analysis[];
}

export async function insertAnalysis(input: {
  competitor_id: string;
  framework: string;
  markdown: string;
  scores: Record<string, number> | null;
  generated_by: string;
}): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    INSERT INTO analyses (competitor_id, framework, scope, markdown, scores, generated_by)
    VALUES (
      ${input.competitor_id}, ${input.framework}, 'whole-org',
      ${input.markdown},
      ${input.scores ? JSON.stringify(input.scores) : null},
      ${input.generated_by}
    )
    RETURNING id
  `;
  return (rows[0] as { id: number }).id;
}

export type CompetitorAnalysisBundle = {
  competitor: Record<string, unknown>;
  ads: Array<Record<string, unknown>>;
  offers: Array<Record<string, unknown>>;
  lead_magnets: Array<Record<string, unknown>>;
  funnel_steps: Array<Record<string, unknown>>;
  public_mentions: Array<Record<string, unknown>>;
};

export async function getCompetitorAnalysisBundle(
  competitorId: string,
): Promise<CompetitorAnalysisBundle | null> {
  const sql = getSql();

  const [competitorRows, ads, offers, leadMagnets, funnelSteps, publicMentions] =
    await Promise.all([
      sql`SELECT * FROM competitors WHERE id = ${competitorId}`,
      sql`
        SELECT
          id, library_id, country, advertiser_page,
          started_at::text, ended_at::text, is_active, duration_days,
          is_evergreen_winner, hook_angle, traffic_temperature,
          headline, body, cta, landing_url, creative_type, ad_library_url
        FROM ads
        WHERE competitor_id = ${competitorId}
        ORDER BY duration_days DESC NULLS LAST, started_at DESC NULLS LAST
      `,
      sql`SELECT * FROM offers WHERE competitor_id = ${competitorId} ORDER BY id`,
      sql`SELECT * FROM lead_magnets WHERE competitor_id = ${competitorId} ORDER BY id`,
      sql`SELECT * FROM funnel_steps WHERE competitor_id = ${competitorId} ORDER BY funnel_name, step_index`,
      sql`SELECT * FROM public_mentions WHERE competitor_id = ${competitorId} ORDER BY date DESC NULLS LAST`,
    ]);

  if (competitorRows.length === 0) return null;

  return {
    competitor: competitorRows[0] as Record<string, unknown>,
    ads: ads as Array<Record<string, unknown>>,
    offers: offers as Array<Record<string, unknown>>,
    lead_magnets: leadMagnets as Array<Record<string, unknown>>,
    funnel_steps: funnelSteps as Array<Record<string, unknown>>,
    public_mentions: publicMentions as Array<Record<string, unknown>>,
  };
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
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type DiscoveryCandidate = {
  id: number;
  page_name: string;
  name_key: string;
  ad_count: number;
  verdict: string;
};

export async function listRuns(): Promise<Run[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, niche_label, niche_key, country, language, keywords,
           discovery_method, status, cost_cents, error,
           created_at::text, started_at::text, finished_at::text
    FROM runs
    ORDER BY created_at DESC
  `;
  return rows as Run[];
}

export async function getRun(id: string): Promise<Run | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, niche_label, niche_key, country, language, keywords,
           discovery_method, status, cost_cents, error,
           created_at::text, started_at::text, finished_at::text
    FROM runs WHERE id = ${id}
  `;
  return (rows[0] as Run) ?? null;
}

// Included competitors for a run, with the same computed ad stats as
// listCompetitors() — reuses CompetitorCard as-is on the run detail page.
export async function listRunCompetitors(runId: string): Promise<Competitor[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      c.id, c.name, c.status, c.hq_country, c.org_type, c.business_type,
      c.org_size_estimate, c.archetype, c.voice_descriptor, c.audience_target,
      c.one_line_summary, c.ad_strategy, c.value_ladder, c.primary_site_url,
      c.last_refreshed_at::text,
      COUNT(a.id)::int                                       AS ad_count,
      COUNT(a.id) FILTER (WHERE a.is_active = true)::int     AS active_count,
      COUNT(a.id) FILTER (WHERE a.is_evergreen_winner = true)::int AS evergreen_count,
      MAX(a.duration_days)::int                              AS longest_run_days
    FROM run_competitors rc
    JOIN competitors c ON c.id = rc.competitor_id
    LEFT JOIN ads a ON a.competitor_id = c.id
    WHERE rc.run_id = ${runId} AND rc.included = true
    GROUP BY c.id, rc.rank
    ORDER BY rc.rank NULLS LAST, c.name
  `;
  return rows as Competitor[];
}

// Everything the filter rejected for this run, for the audit panel —
// see docs/ for why this table exists (a spam page must show up here
// present-and-rejected, not silently absent).
export async function listRejectedCandidates(runId: string): Promise<DiscoveryCandidate[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, page_name, name_key, ad_count, verdict
    FROM discovery_candidates
    WHERE run_id = ${runId} AND verdict != 'accepted'
    ORDER BY ad_count DESC
  `;
  return rows as DiscoveryCandidate[];
}

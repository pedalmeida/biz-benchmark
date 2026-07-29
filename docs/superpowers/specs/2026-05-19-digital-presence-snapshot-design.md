# Digital Presence Snapshot — design spec

**Status:** Approved 2026-05-19. Ready for `/writing-plans`.
**Brainstorm transcript:** session of 2026-05-19, am-benchmark project.
**Implements:** new "Snapshot" feature on top of Phase 7 (analyses) + the org-logos / socials work landed earlier this session.

---

## 1. Problem

Right now the am-benchmark admin shows fragmented intelligence per competitor: ads, hooks, value ladders, socials, follower counts. There is no single view that answers either of these two questions:

- **A. "Who's worth copying right now?"** Which competitor is surging vs. fading? Where should Pedro focus his benchmarking attention this week?
- **B. "What does dominance look like?"** What is the total digital reach of each org across all channels, as a baseline for comparing AM later?

The current UI surfaces *details*. It does not surface *standing*. A Brunson-style funnel hack works one org at a time; a digital-presence dashboard works the whole list at once.

## 2. Out of scope

Stated explicitly so the design stays honest:

- **AM itself** in the snapshot. v1 is competitor-only. AM joins as a row once we have a comparable baseline.
- **Paid SEO/marketing-intelligence subscriptions** (SEMrush, Ahrefs, Brandwatch). Free Similarweb + Firecrawl + existing Apify credits + free Wikipedia / YouTube APIs only.
- **Real-time updates.** Monthly cron + on-demand button is the cadence.
- **TikTok depth.** None of the 8 v1 competitors are seriously on TikTok.
- **Podcast presence, app stores, press mentions, tech stack signal, domain age, blurred organic keywords.** Considered, deferred to v2 (see §8).
- **Newsletter content / cadence beyond presence detection.** v1 detects "is there a newsletter?" and captures the opt-in offer copy; it does not subscribe or measure send frequency.

## 3. Use cases (locked)

Both A and B from §1, with equal weight. The design must support:

| Use case | UI surface | Data shape required |
|---|---|---|
| A — "who's surging?" | Cross-competitor league table at `/snapshot` | Per-metric history with sparklines + month-over-month delta |
| B — "what does dominance look like?" | Per-competitor `/competitors/[id]/snapshot` tab | Absolute current values across all KPIs, side-by-side |

## 4. KPI shortlist (locked)

Nine KPIs across five channels. Each has a collector (§5) and a UI treatment (§6).

| # | KPI | metric_key | Source | Value column |
|---|---|---|---|---|
| 1 | Est. monthly website visits | `website.visits_monthly` | Firecrawl scrape of similarweb.com | `_num` |
| 2 | Traffic source breakdown | `website.traffic_sources` | Firecrawl scrape of similarweb.com | `_json` `{direct,search,social,referral,other}` |
| 3 | Wikipedia pageviews (30d) | `wikipedia.pageviews_30d` | Wikimedia REST API | `_num` (0 if no page) |
| 4a | YouTube subscribers | `youtube.subscribers` | YT Data API v3 | `_num` |
| 4b | YouTube total views | `youtube.total_views` | YT Data API v3 | `_num` |
| 4c | YouTube uploads (30d) | `youtube.uploads_30d` | YT Data API v3 | `_num` |
| 4d | YouTube avg views per upload | `youtube.avg_views_per_upload` | YT Data API v3 | `_num` |
| 5a | Newsletter present | `newsletter.present` | Firecrawl homepage scrape | `_num` (0/1) |
| 5b | Newsletter offer copy | `newsletter.offer` | Firecrawl homepage scrape | `_text` |
| 6a | Instagram posts (30d) | `instagram.posts_30d` | Apify `apify/instagram-profile-scraper` | `_num` |
| 6b | Instagram engagement rate | `instagram.engagement_rate` | Apify same actor | `_num` (0.0–1.0) |
| 6c | Last Instagram post | `instagram.last_post_at` | Apify same actor | `_text` (ISO date) |
| 7 | Ad activity score | `computed.ad_activity_score` | Computed: `active_ads × 1 + evergreen_winners × 5` | `_num` |
| 8 | Value ladder completeness | `computed.ladder_completeness` | Computed: rung-types-present / 9 canonical types | `_num` (0.0–1.0) |
| 9 | Channel coverage score | `computed.channel_coverage_score` | Computed: presence of {website, IG canonical, YT canonical, FB canonical, newsletter} | `_num` (0–5) |

**Why these nine** (vs. the longer menu considered): every KPI here either has a free or already-paid data source, returns a sortable scalar for the league table, AND speaks to both use case A (history → sparkline) and B (current value → ranking).

## 5. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ UI (Next.js admin)                                                   │
│  /snapshot                  NEW cross-competitor league table        │
│  /competitors/[id]/snapshot NEW per-competitor Snapshot tab          │
└────────────────────▲─────────────────────────────────────────────────┘
                     │ reads via Next API → Neon
┌────────────────────┴─────────────────────────────────────────────────┐
│ Neon Postgres                                                        │
│  competitor_metrics              append-only event log (tall table)  │
│  mv_competitor_snapshot_latest   pivoted "current state" mat. view   │
│  scrape_jobs                     existing audit log, reused          │
└────────────────────▲─────────────────────────────────────────────────┘
                     │ INSERTs (per collector, independent)
┌────────────────────┴─────────────────────────────────────────────────┐
│ Railway worker (existing)                                            │
│  POST /snapshot/refresh { competitor_id }                            │
│    1. Creates scrape_jobs row (trigger='snapshot-refresh')           │
│    2. Fans out 5 external collectors in parallel (Promise.allSettled)│
│       then runs 'computed' once they're done (it depends on the      │
│       newsletter result for channel_coverage_score):                 │
│        ├─ similarweb       Firecrawl scrape → 2 metrics     ┐        │
│        ├─ wikipedia        Wikimedia REST API → 1 metric    │        │
│        ├─ youtube          YT Data API v3 → 4 metrics       ├ parallel│
│        ├─ newsletter       Firecrawl homepage → 2 metrics   │        │
│        └─ instagram-depth  Apify instagram-profile-scraper  ┘        │
│        ↓                                                             │
│        computed            Reads ads/value_ladder/intel → 3 metrics  │
│    3. Each collector writes its own competitor_metrics rows          │
│       (with status='ok'|'failed' + error_message + source).          │
│    4. Updates scrape_jobs row with summary (records_added per src).  │
│    5. REFRESH MATERIALIZED VIEW CONCURRENTLY                         │
│       mv_competitor_snapshot_latest.                                 │
└──────────────────────────────────────────────────────────────────────┘
                     ▲
                     │ HTTP from admin API ("Refresh snapshot" button)
                     │ HTTP from GitHub Actions cron (monthly)
                     │
┌────────────────────┴─────────────────────────────────────────────────┐
│ GitHub Actions cron                                                  │
│  .github/workflows/monthly-snapshot.yml — 1st of month, 06:00 UTC    │
│  Iterates active competitors → POSTs each to worker (serially, 30s   │
│  spacing to stay polite with Apify + similarweb).                    │
└──────────────────────────────────────────────────────────────────────┘
```

**Why collectors live in the worker (Railway), not the admin (Vercel):**
Apify Instagram calls take 30–90s. Firecrawl scrapes take 10–20s. Vercel Hobby functions cap at 5 minutes — close but risky once we parallelise + retry. Worker is already running 24/7 for ad scraping, has the credentials, and has no execution-time ceiling. The admin app calls the worker; same pattern as `/api/competitors/[id]/trigger-scrape`.

**Why six parallel collectors with `Promise.allSettled`:**
Apify Instagram or Similarweb's HTML *will* break sometimes (rate limits, DOM changes, bans). Capturing failures per-source instead of as a single transaction means YouTube + Wikipedia + computed metrics still land when Apify is down. The `status='failed'` row records the error so debugging doesn't need worker logs.

## 6. Data model

### 6.1 `competitor_metrics` (new table)

```sql
CREATE TABLE IF NOT EXISTS competitor_metrics (
  id                BIGSERIAL PRIMARY KEY,
  competitor_id     TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,

  metric_key        TEXT NOT NULL,        -- 'website.visits_monthly', etc. (see §4)
  metric_value_num  NUMERIC,              -- numeric metrics
  metric_value_text TEXT,                 -- short string metrics
  metric_value_json JSONB,                -- structured metrics

  source            TEXT NOT NULL,        -- 'similarweb-free' | 'apify-ig-profile' |
                                          -- 'youtube-api' | 'wikipedia-api' |
                                          -- 'firecrawl-newsletter' | 'computed'
  status            TEXT NOT NULL DEFAULT 'ok', -- 'ok' | 'failed' | 'unsupported' | 'rate-limited'
  error_message     TEXT,                 -- populated when status != 'ok'

  captured_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scrape_job_id     INTEGER REFERENCES scrape_jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS competitor_metrics_lookup
  ON competitor_metrics (competitor_id, metric_key, captured_at DESC);
CREATE INDEX IF NOT EXISTS competitor_metrics_recent
  ON competitor_metrics (captured_at DESC);
```

**Notes:**
- Three typed value columns (`_num`, `_text`, `_json`); exactly one populated per row.
- No `UNIQUE` on `(competitor_id, metric_key)` — append-only builds history.
- `status` is separate from `metric_value`. A `failed` row still gets written so missing data is *explained*, not silent.
- `scrape_job_id` joins this table to the existing audit log; no second audit pattern.

### 6.2 `mv_competitor_snapshot_latest` (materialised view)

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_competitor_snapshot_latest AS
WITH ranked AS (
  SELECT
    competitor_id, metric_key, metric_value_num, metric_value_text,
    metric_value_json, source, status, captured_at,
    ROW_NUMBER() OVER (
      PARTITION BY competitor_id, metric_key
      ORDER BY captured_at DESC
    ) AS rn
  FROM competitor_metrics
  WHERE status = 'ok'
)
SELECT competitor_id, metric_key, metric_value_num, metric_value_text,
       metric_value_json, source, captured_at
FROM ranked WHERE rn = 1;

-- Required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS mv_competitor_snapshot_latest_pk
  ON mv_competitor_snapshot_latest (competitor_id, metric_key);
```

Refreshed `CONCURRENTLY` at the end of every `/snapshot/refresh` so the league table is always consistent and never blocks reads.

### 6.3 Migration

`data/migrations/0002_competitor_metrics.sql` — idempotent. Includes both DDL blocks above.

### 6.4 TypeScript contract

```ts
// apps/admin/lib/queries.ts
export type MetricKey =
  | 'website.visits_monthly'
  | 'website.traffic_sources'
  | 'wikipedia.pageviews_30d'
  | 'youtube.subscribers'
  | 'youtube.total_views'
  | 'youtube.uploads_30d'
  | 'youtube.avg_views_per_upload'
  | 'newsletter.present'
  | 'newsletter.offer'
  | 'instagram.posts_30d'
  | 'instagram.engagement_rate'
  | 'instagram.last_post_at'
  | 'computed.ad_activity_score'
  | 'computed.ladder_completeness'
  | 'computed.channel_coverage_score';

export type MetricValue = {
  num: number | null;
  text: string | null;
  json: unknown | null;
};

export type MetricStatus = 'ok' | 'failed' | 'unsupported' | 'rate-limited';

export type CompetitorMetric = {
  competitor_id: string;
  metric_key: MetricKey;
  value: MetricValue;
  source: string;
  status: MetricStatus;
  captured_at: string;
};
```

This enum is the contract between collectors (worker) and consumers (admin UI). Adding a v2 KPI = add one literal here + one collector + one UI row. No DB migration.

### 6.5 Query helpers (`apps/admin/lib/queries.ts`)

```ts
// League table — one row per competitor, pivoted from the mat view
export async function getSnapshotLeagueTable(): Promise<Array<{
  competitor_id: string;
  competitor_name: string;
  metrics: Partial<Record<MetricKey, MetricValue & { source: string; captured_at: string }>>;
}>>;

// Per-competitor latest snapshot (all 15 metrics in one shot)
export async function getCompetitorSnapshot(
  competitorId: string
): Promise<Partial<Record<MetricKey, MetricValue & { source: string; captured_at: string }>>>;

// History for one (competitor, metric) — drives sparklines
export async function getMetricHistory(
  competitorId: string,
  metricKey: MetricKey,
  limit?: number   // default 12 (12 monthly snapshots)
): Promise<Array<{ captured_at: string; value: MetricValue }>>;
```

## 7. Collectors

Each collector is its own file in `apps/worker/src/snapshot/collectors/`. Same contract:

```ts
interface CollectorResult {
  metrics: Array<{
    metric_key: MetricKey;
    value: MetricValue;          // exactly one of num/text/json set
    status: MetricStatus;
    error_message?: string;
  }>;
}

interface Collector {
  source: string;                // 'similarweb-free' | etc.
  collect(competitor: CompetitorRow, intelSources: IntelSource[]): Promise<CollectorResult>;
}
```

Per-collector details:

### 7.1 `similarweb.ts` — `source='similarweb-free'`

- **Input:** competitor's `primary_site_url` host.
- **URL:** `https://www.similarweb.com/website/${host}/`.
- **Method:** Firecrawl scrape (~1 credit). Parses rendered page.
- **Selectors / extraction:**
  - `website.visits_monthly` — the "Total Visits" headline number (free tier shows one month).
  - `website.traffic_sources` — the 5-bar breakdown (Direct/Search/Social/Referrals/Display/Mail). Some buckets may be `0` for small sites.
- **Failure modes:** site too small (Similarweb shows "Insufficient data"), HTML structure change, rate limit. Set `status='unsupported'` for insufficient data; `'failed'` for parse errors.
- **Cost:** ~1 Firecrawl credit / competitor / refresh = ~8 credits / month.

### 7.2 `wikipedia.ts` — `source='wikipedia-api'`

- **Input:** competitor's English name.
- **Lookup:** `GET https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=<name>&format=json` to resolve to a canonical page title. Cache the resolved title on `competitors.wikipedia_title` after first success (new column in migration; optional).
- **Pageviews:** `GET https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/<title>/daily/<start>/<end>` — sum the last 30 days.
- **Output:** `wikipedia.pageviews_30d` (0 if no page found, with `status='ok'` since "no page" is a legitimate answer, not a failure).
- **Failure modes:** ambiguous name (multiple matches), API rate limit (very high — unlikely to hit).
- **Cost:** Free.

### 7.3 `youtube.ts` — `source='youtube-api'`

- **Input:** canonical YouTube channel from `intel_sources` (`source_type='youtube_channel'`, `is_canonical=true`). Skip if none.
- **API:** YouTube Data API v3, `channels.list?part=statistics,snippet,contentDetails` for sub/view/video count, then `playlistItems.list` on the uploads playlist + `videos.list` for last-30-day uploads.
- **Metrics:** `youtube.subscribers`, `youtube.total_views`, `youtube.uploads_30d`, `youtube.avg_views_per_upload`.
- **Quota:** ~5 units / competitor / refresh. 10K daily quota = plenty.
- **Failure modes:** channel deleted, handle URL doesn't resolve to ID. Add a step to resolve handle → channel ID first; cache it on `intel_sources.youtube_channel_id` (optional migration column).
- **Cost:** Free.
- **Env:** `YOUTUBE_API_KEY` (new — needs adding to worker + Vercel).

### 7.4 `newsletter.ts` — `source='firecrawl-newsletter'`

- **Input:** competitor's `primary_site_url`.
- **Method:** Firecrawl scrape of the homepage (~1 credit).
- **Heuristic:**
  - `newsletter.present = 1` if HTML matches any of:
    - `<input type="email">` with surrounding "newsletter" / "subscribe" / "updates" copy
    - Common email-capture vendors (Mailchimp `mc-form`, ConvertKit `formkit-form`, Klaviyo, Substack iframe).
    - Popup detection via Firecrawl screenshot + heuristic (deferred — v1 is DOM-based).
  - `newsletter.offer` — the headline copy near the form (within 200 chars of the input). Set to `null` if `present=0`.
- **Failure modes:** JS-rendered forms (Firecrawl's "wait for JS" flag handles most). For SPA-only sites, may miss real forms; mark `status='ok'` with `present=0` and accept the false negative.
- **Cost:** ~1 Firecrawl credit / competitor / refresh = ~8 credits / month.

### 7.5 `instagram-depth.ts` — `source='apify-ig-profile'`

- **Input:** canonical IG handle from `intel_sources`. Skip if none.
- **Actor:** `apify/instagram-profile-scraper` — returns profile metadata + last N posts.
- **Computation:**
  - `instagram.posts_30d` — count posts in the last 30 days.
  - `instagram.engagement_rate` — average `(likes + comments) / followers_count` across the last 12 posts; null if `followers_count == 0`.
  - `instagram.last_post_at` — most recent post timestamp.
- **Cost:** ~$0.30–0.50 / competitor / refresh = **~$2.40–4 / month** for 8 competitors.
- **Failure modes:** private account, account suspended, actor rate-limited by Meta. `status='failed'` with error message.
- **Env:** `APIFY_TOKEN` (already on Railway worker presumably; add to migration checklist).

### 7.6 `computed.ts` — `source='computed'`

No external calls. Reads from Neon directly inside the worker.

- `computed.ad_activity_score`:
  ```
  active_ads × 1 + evergreen_winners × 5
  ```
  where `active_ads = COUNT(*) FROM ads WHERE competitor_id=$1 AND is_active=true` and `evergreen_winners = COUNT(*) FROM ads WHERE competitor_id=$1 AND is_evergreen_winner=true`.

- `computed.ladder_completeness`:
  ```
  distinct_rung_types_present / 9
  ```
  Canonical rung types (from `skill-refs/brunson/`): `intro`, `lead-magnet`, `tripwire`, `core`, `flagship`, `continuity`, `retreat`, `ttc`, `advanced`. Lower-cased and matched against `competitors.value_ladder[].type`.

- `computed.channel_coverage_score`:
  ```
  (has website + has canonical IG + has canonical YT + has canonical FB + has newsletter) -- 0-5
  ```
  `has newsletter` reads the most recent `newsletter.present` metric (this means computed runs **after** newsletter collector — see §7.7 ordering).

### 7.7 Collector ordering

`computed` depends on `newsletter` (for channel coverage). Worker runs:

1. Parallel batch: `similarweb`, `wikipedia`, `youtube`, `newsletter`, `instagram-depth` (5 collectors via `Promise.allSettled`).
2. Sequential after #1: `computed`.
3. After both: `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_competitor_snapshot_latest`.

Total wall-clock: dominated by Apify (~30–60s) since the others run in parallel and complete in <10s each.

## 8. UI

### 8.1 `/snapshot` — cross-competitor league table

Layout: sticky filter bar + sortable table.

**Columns** (in this order):
1. Competitor (logo + name — uses `<OrgLogo>` from this session)
2. Channel coverage (badge, 0–5 with colour: 0–2 red, 3 amber, 4–5 green)
3. Ad activity (numeric, sortable)
4. IG followers (already in `intel_sources` — joined in, not from new metrics)
5. IG engagement rate (from new metrics, `%`)
6. YT subscribers
7. Monthly visits (Similarweb)
8. Newsletter (✓ / ✗ icon)
9. Ladder completeness (% bar)
10. Wikipedia 30d (numeric)
11. Last refreshed (relative time)

Each numeric column sortable both directions. Default sort: ad activity descending (use case A: who's actively pushing right now). Secondary sort selector at the top for fast pivoting ("rank by IG engagement", "rank by ladder completeness").

**Row hover:** highlights row and shows a "refresh" icon (calls worker `/snapshot/refresh` for that competitor). **Row click:** navigates to `/competitors/<id>/snapshot`.

**Empty state:** if a competitor has never been snapshotted, the row shows "—" everywhere except for joined-in IG followers and computed metrics. A "Refresh snapshot" CTA at the row level.

### 8.2 `/competitors/[id]/snapshot` — per-competitor depth (new tab)

New tab in the existing tab nav (Overview / Ads / Value Ladder / **Snapshot** / Analyses).

Layout: 3-column grid of metric cards, then a "History" section underneath.

**Each metric card** has:
- Metric label (e.g. "Monthly website visits")
- Current value (the largest number on the card)
- Sparkline of the last 12 snapshots (`getMetricHistory(id, key, 12)`).
- Month-over-month delta as text + arrow (▲ +12% / ▼ −8% / — flat).
- Source attribution in small text ("from Similarweb, 2026-05-19").
- Status pill if `status != 'ok'` ("Last refresh failed — Apify rate limit").

**Sparkline:** lightweight inline SVG, no chart library — single path drawn from history points, no axes. Hover shows the value at that point. Renders empty state ("No history yet — refresh to start collecting") if < 2 data points.

**Section order on the page:**
1. Headline: channel coverage 0–5 + composite "presence score" (sum of normalised KPIs) for quick read.
2. **Audience reach** — IG followers, YT subscribers, Wikipedia 30d pageviews.
3. **Activity** — Ad activity score, IG posts/30d + engagement rate, YT uploads/30d.
4. **Funnel maturity** — ladder completeness, newsletter present + offer, monthly visits.
5. **Traffic mix** — full bar chart of Similarweb traffic sources (the JSON metric).

**"Refresh snapshot" button** in the header, same affordance as `<ScrapeTrigger>`. Disabled while a refresh is in-flight; shows spinner.

### 8.3 Components to build

- `<MetricCard>` — value + sparkline + delta + source attribution + status pill.
- `<Sparkline>` — pure SVG, no deps.
- `<ChannelCoverageBadge>` — 0–5 with colour ramp, used in both views.
- `<SnapshotLeagueTable>` — sortable client component with filter bar.
- `<SnapshotRefreshButton>` — same pattern as `<ScrapeTrigger>`, polls for completion.
- `<TrafficSourcesBar>` — horizontal stacked bar for `website.traffic_sources` JSON.

## 9. Refresh orchestration

### 9.1 Admin API route

`POST /api/competitors/[id]/refresh-snapshot` — auth-gated. Calls worker `/snapshot/refresh` with the same `x-worker-secret` pattern as the existing trigger-scrape route. Returns `{ ok: true, job_id }`. Worker creates a `scrape_jobs` row with `trigger='snapshot-refresh'` and `sources=['similarweb','wikipedia','youtube','newsletter','instagram-depth','computed']`.

### 9.2 Worker endpoint

`POST /snapshot/refresh { competitor_id }` — runs the 6-collector pipeline described in §5/§7.7. Returns `{ job_id, status, summary: { collected: N, failed: M } }`.

### 9.3 Status polling

Reuses the existing `/api/competitors/[id]/scrape-status` route. It already reads from `scrape_jobs`. The Snapshot UI uses the same `<ScrapeTrigger>`-style polling component.

### 9.4 Monthly cron

`.github/workflows/monthly-snapshot.yml`:

```yaml
on:
  schedule:
    - cron: '0 6 1 * *'   # 1st of every month, 06:00 UTC
  workflow_dispatch:        # manual trigger from GH UI

jobs:
  refresh-all:
    runs-on: ubuntu-latest
    steps:
      - name: Refresh snapshot for each active competitor
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          WORKER_URL: ${{ secrets.WORKER_URL }}
          WORKER_SECRET: ${{ secrets.WORKER_SECRET }}
        run: |
          competitors=$(psql "$DATABASE_URL" -tAc \
            "SELECT id FROM competitors WHERE status='active' ORDER BY id")
          for id in $competitors; do
            echo "refreshing $id..."
            curl -fsS -X POST "$WORKER_URL/snapshot/refresh" \
              -H "Content-Type: application/json" \
              -H "x-worker-secret: $WORKER_SECRET" \
              -d "{\"competitor_id\":\"$id\"}"
            sleep 30   # polite spacing between Apify calls
          done
```

Manual override: GitHub Actions UI → workflow_dispatch button.

## 10. Error handling

- **Per-source failures** are recorded as `status='failed'` rows with `error_message`. They appear in the UI with a status pill but do not block other metrics from being captured.
- **Repeated failures** for the same `(competitor_id, metric_key)` should be visible. Add a query/page in v2 if it becomes a problem; v1 just shows the failed pill on the metric card.
- **API key missing** at startup (e.g. no `YOUTUBE_API_KEY`) → collector self-disables, writes `status='unsupported'` row with `error_message='YOUTUBE_API_KEY not configured'` on every call. Loud but not fatal.
- **Apify cost budget** — add a hard ceiling: if `APIFY_MONTHLY_BUDGET` (env var, default $20) is exceeded for the current calendar month, the IG collector self-disables and writes `status='rate-limited'` rows. Surfaced in the worker logs and on the metric card.
- **Worker timeout** for the whole `/snapshot/refresh` call — 5 minutes hard cap. If hit, the `scrape_jobs` row is left in `status='partial'` and whichever metrics did land are kept.

## 11. Observability

- `scrape_jobs` already gives per-run audit. Snapshot refreshes show up alongside ad refreshes.
- Per-source success rate visible in the admin via a new admin-only page `/snapshot/health` (v1.5): "Similarweb: 8/8 ok last month, 7/8 ok this month". Skipped from v1 if it bloats scope.
- Apify cost spent per month: read from Apify dashboard initially; consider polling Apify's billing API later.

## 12. Migration + seed plan

1. **`data/migrations/0002_competitor_metrics.sql`** — creates `competitor_metrics` + `mv_competitor_snapshot_latest` + indexes.
2. **`data/migrations/0003_intel_sources_youtube_channel_id.sql`** — adds optional `youtube_channel_id`, `wikipedia_title` cache columns to `intel_sources` / `competitors` (for collector efficiency). Idempotent.
3. **No data seed.** Snapshot data is collected, not seeded — the cron + on-demand button generate it. Day-1 UX: the league table shows "—" for all metrics until the first refresh completes.
4. **One-shot backfill script** (`scripts/refresh-all-snapshots.ts`) so day-1 actually has data without waiting for the cron — calls `/snapshot/refresh` for each active competitor with 30s spacing.

## 13. Cost ceiling

Per-refresh, per-competitor:
- Firecrawl: ~2 credits (similarweb + newsletter) = ~16 credits/month across 8 competitors.
- Apify: ~$0.40 (IG) = ~$3.20/month.
- YouTube + Wikipedia: free.
- Computed: free.

**Total: ~16 Firecrawl credits + ~$3.20 Apify per month.** Well under your existing budget.

## 14. Open questions

None blocking. Three items to validate during implementation:

- **Similarweb HTML structure** — its DOM rewrites break parsers periodically. If the free Similarweb scrape proves brittle, fall back to Apify's `tri_angle/similarweb-scraper` actor (~$0.005 / domain). Spec is structured so this swap is a single collector file.
- **YouTube handle → channel ID resolution** — only known if we test on a real handle (`@ishafoundation` etc.). Belongs in the implementation plan.
- **Engagement rate baseline** — "average over last 12 posts" is one of several possible formulas. Document the choice in the metric description on the UI so users know what they're looking at.

## 15. Dependencies on this session's work

This spec builds directly on what landed in the same session:

- `intel_sources` table (Phase: socials) — provides the canonical IG handle, YT channel URL, FB URL used by collectors.
- `<OrgLogo>`, `<SocialPills>` components — reused unchanged in the league table.
- `scrape_jobs` audit pattern — extended to cover snapshot refreshes.
- Railway worker `/scrape` + `WORKER_URL`/`WORKER_SECRET` plumbing — same pattern, new endpoint.
- `data/migrations/` + `data/seeds/` workflow (introduced this session) — used for the new migration.

## 16. What this spec deliberately defers (v2 candidates)

Logged so we don't lose them:

- TikTok depth, podcast presence (org + guest), app store reviews, press mentions, tech stack signal, domain age, Similarweb organic keywords (blurred on free tier).
- Per-rung ad attribution (which ads feed which rung) — already noted as a future LLM-classification job from the ladder work.
- AM itself as a row in the league table.
- Newsletter content / send cadence (not just presence).
- Slack/Telegram notifications when momentum signals trigger ("Kadampa's IG followers +20% MoM").
- Apify cost dashboard inside the admin.
- `/snapshot/health` — per-source success-rate page.

---

**Ready for `/writing-plans`.**

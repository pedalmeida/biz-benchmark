-- =============================================================
-- biz-benchmark Schema v2
-- =============================================================
-- This schema is dossier-oriented. One competitor has many intel
-- streams: ads, funnel steps, lead magnets, offers, public mentions,
-- dossier sections, framework analyses, and audit logs.
--
-- v2 adds `runs`: a niche+country benchmark request is a first-class
-- entity, so competitor discovery can be automatic instead of added by
-- hand. Competitors themselves stay global (not scoped per run) — the
-- same business can surface in more than one niche/keyword search, and
-- duplicating it per run would double scraping cost and split its ad
-- history. Run isolation happens at read time via `run_competitors`.
-- =============================================================

-- =============================================================
-- COMPETITORS (one row per org)
-- =============================================================
CREATE TABLE IF NOT EXISTS competitors (
  id                          TEXT PRIMARY KEY,         -- slug: "kadampa-deuachen"
  name                        TEXT NOT NULL,
  status                      TEXT DEFAULT 'active',    -- active | archived | wip
  added_at                    TIMESTAMPTZ DEFAULT NOW(),
  last_refreshed_at           TIMESTAMPTZ,

  -- Core identity
  primary_site_url            TEXT,
  founder                     TEXT,
  founder_alive               BOOLEAN,
  hq_country                  TEXT,
  hq_city                     TEXT,
  org_type                    TEXT,                     -- deprecated, superseded by business_type below — kept unused to avoid a destructive column drop
  org_size_estimate           TEXT,                     -- single-center | regional | national | global | mega-global

  -- v2: discovery + genericization
  meta_page_id                TEXT UNIQUE,              -- stable Meta page ID, when the discovery adapter provides one (Graph API branch)
  meta_page_slug              TEXT,                     -- facebook.com/<slug> — the dedupe key on the Firecrawl-keyword-search branch
  business_type               TEXT,                     -- free text, LLM-filled (e.g. "dental clinic") — replaces the closed org_type vocabulary
  source                      TEXT DEFAULT 'manual',    -- manual | auto — auto = created by a run's discovery pipeline

  -- Positioning (LLM-populated, editable)
  archetype                   TEXT,                     -- sage | reluctant-hero | adventurer | avatar | warrior
  attractive_character_name   TEXT,
  attractive_character_alive  BOOLEAN,
  voice_descriptor            TEXT,
  audience_target             TEXT,
  positioning_notes           TEXT,

  -- High-level summary
  one_line_summary            TEXT,
  ad_strategy                 TEXT,                     -- always-on | event-funnel | event-pulse | decentralized | multi-brand | course-finder | none
  value_ladder                JSONB,                    -- [{rung, offer, price, type}, ...]
  funnel_archetype            TEXT,                     -- opt-in | webinar | application | bridge | continuity | summit

  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================
-- INTEL_SOURCES (external profiles / handles per competitor)
-- =============================================================
CREATE TABLE IF NOT EXISTS intel_sources (
  id              SERIAL PRIMARY KEY,
  competitor_id   TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  source_type     TEXT NOT NULL,                        -- website | meta_page | instagram | youtube_channel | linkedin_company | tiktok | podcast | google_business
  url             TEXT NOT NULL,
  handle          TEXT,                                 -- @username (no @ stored)
  display_name    TEXT,                                 -- shown name for the account (different from handle)
  follower_count  INTEGER,                              -- followers / subscribers — null if not collected
  scrape_strategy TEXT,                                 -- firecrawl_scrape | firecrawl_crawl | apify | meta_ad_library | youtube_api | manual
  last_scraped_at TIMESTAMPTZ,
  verified_at     TIMESTAMPTZ,                          -- when follower_count was last confirmed
  is_canonical    BOOLEAN DEFAULT FALSE,
  UNIQUE (competitor_id, source_type, url)
);

CREATE INDEX IF NOT EXISTS intel_sources_competitor ON intel_sources(competitor_id);

-- =============================================================
-- RUNS (a niche+country benchmark request — v2's core new entity)
-- =============================================================
CREATE TABLE IF NOT EXISTS runs (
  id                TEXT PRIMARY KEY,          -- e.g. "clinicas-dentarias-pt-20260729"
  niche_label       TEXT NOT NULL,              -- verbatim user input, e.g. "clínicas dentárias"
  niche_key         TEXT NOT NULL,              -- normalized (lowercase, no diacritics) — cache lookup key
  country           TEXT NOT NULL,              -- ISO-2, e.g. "PT"
  language          TEXT,                       -- detected during keyword expansion, e.g. "pt"
  keywords          TEXT[],                     -- expanded search terms actually used for discovery
  discovery_method  TEXT,                       -- graph_ads_archive | firecrawl_keyword
  status            TEXT DEFAULT 'queued',      -- queued|discovering|scraping|classifying|funnels|ready|failed|no_competitors_found
  requester_email   TEXT,                       -- Phase 2 hook: who asked for this run
  requester_ip_hash TEXT,                       -- Phase 2 hook: rate limiting
  requester_context JSONB,                      -- Phase 2 hook: {business_name, what_they_sell, budget_band, goal} — feeds challenger-recommendation
  cost_cents        INTEGER DEFAULT 0,
  error             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS runs_cache ON runs(niche_key, country, finished_at DESC) WHERE status = 'ready';

-- =============================================================
-- RUN_COMPETITORS (many-to-many: a competitor can surface in >1 run)
-- =============================================================
CREATE TABLE IF NOT EXISTS run_competitors (
  run_id           TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  competitor_id    TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  discovered_via   TEXT,                                  -- which keyword surfaced it
  relevance_score  NUMERIC,                                -- 0..1, from the LLM relevance pass
  relevance_reason TEXT,
  included         BOOLEAN DEFAULT TRUE,                  -- false = filtered as spam/off-niche, kept for audit
  rank             INTEGER,
  PRIMARY KEY (run_id, competitor_id)
);

-- =============================================================
-- DISCOVERY_CANDIDATES (raw pre-dedupe evidence — the filter's audit trail)
-- =============================================================
CREATE TABLE IF NOT EXISTS discovery_candidates (
  id            SERIAL PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  page_id       TEXT,                                     -- null on the Firecrawl branch
  page_slug     TEXT,                                     -- from the parser's advertiser_page_slug
  page_name     TEXT NOT NULL,
  name_key      TEXT NOT NULL,                             -- normalized dedupe key (lowercase, no diacritics, no legal/location suffixes)
  ad_count      INTEGER,
  currencies    TEXT[],
  sample_bodies TEXT[],
  verdict       TEXT,                                      -- accepted | rejected_gibberish | rejected_currency | rejected_empty | rejected_llm | rejected_rank
  raw           JSONB,
  UNIQUE (run_id, name_key)
);

-- =============================================================
-- ADS (one row per Meta ad, extensible to other platforms)
-- =============================================================
CREATE TABLE IF NOT EXISTS ads (
  id                  TEXT PRIMARY KEY,                 -- "<competitor>-<library_id>"
  competitor_id       TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  platform            TEXT DEFAULT 'meta',              -- meta | google | linkedin | tiktok
  library_id          TEXT NOT NULL,
  country             TEXT NOT NULL,
  advertiser_page     TEXT,
  advertiser_page_slug TEXT,                            -- facebook.com/<slug> — stable dedupe key, display name is not
  started_at          DATE,
  ended_at            DATE,
  is_active           BOOLEAN,
  -- duration_days: app/seed computes on insert/refresh as
  --   GREATEST(0, COALESCE(ended_at, CURRENT_DATE) - started_at)
  -- (Postgres won't let us make it GENERATED because CURRENT_DATE is non-immutable.)
  duration_days       INTEGER,
  creative_variants   INTEGER DEFAULT 1,
  is_evergreen_winner BOOLEAN DEFAULT FALSE,
  hook_angle          TEXT,                             -- see packages/shared/src/taxonomy.ts HOOK_ANGLES — generic, niche-agnostic vocabulary
  traffic_temperature TEXT,                             -- cold | warm | hot
  headline            TEXT,
  body                TEXT,
  hashtags            TEXT[],
  cta                 TEXT,
  landing_url         TEXT,
  creative_type       TEXT,                             -- video | image | carousel
  ad_library_url      TEXT,
  raw_scrape_md       TEXT,
  captured_at         DATE NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ads_competitor      ON ads(competitor_id);
CREATE INDEX IF NOT EXISTS ads_active          ON ads(is_active);
CREATE INDEX IF NOT EXISTS ads_hook            ON ads(hook_angle);
CREATE INDEX IF NOT EXISTS ads_country         ON ads(country);
CREATE INDEX IF NOT EXISTS ads_evergreen       ON ads(is_evergreen_winner) WHERE is_evergreen_winner;

-- =============================================================
-- AD_ASSETS (creative images, screenshots, videos per ad)
-- =============================================================
CREATE TABLE IF NOT EXISTS ad_assets (
  id            SERIAL PRIMARY KEY,
  ad_id         TEXT NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  asset_type    TEXT,                                   -- creative-image | screenshot | video
  storage_path  TEXT,                                   -- e.g. assets/<competitor>/ad-XXX.jpg
  source_url    TEXT,
  downloaded_at TIMESTAMPTZ,
  bytes         INTEGER
);

CREATE INDEX IF NOT EXISTS ad_assets_ad ON ad_assets(ad_id);

-- =============================================================
-- FUNNEL_STEPS (page-by-page sequence inferred from website crawl)
-- =============================================================
CREATE TABLE IF NOT EXISTS funnel_steps (
  id                SERIAL PRIMARY KEY,
  competitor_id     TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  funnel_name       TEXT,                               -- e.g. "darshan-portugal-2025"
  step_index        INTEGER,
  step_role         TEXT,                               -- ad | bridge | opt-in | sales | order-bump | upsell | thank-you | continuity
  url               TEXT,
  hero_headline     TEXT,
  primary_cta       TEXT,
  body_excerpt      TEXT,
  has_email_capture BOOLEAN,
  has_pricing       BOOLEAN,
  has_quiz          BOOLEAN,
  has_testimonials  BOOLEAN,
  has_video         BOOLEAN,
  notes             TEXT,
  captured_at       DATE
);

CREATE INDEX IF NOT EXISTS funnel_steps_competitor ON funnel_steps(competitor_id);
CREATE INDEX IF NOT EXISTS funnel_steps_funnel     ON funnel_steps(competitor_id, funnel_name);

-- =============================================================
-- LEAD_MAGNETS
-- =============================================================
CREATE TABLE IF NOT EXISTS lead_magnets (
  id             SERIAL PRIMARY KEY,
  competitor_id  TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  magnet_type    TEXT,                                  -- pdf | course | quiz | webinar | tool | template | newsletter | free-session
  title          TEXT,
  url            TEXT,
  promise        TEXT,
  capture_fields TEXT[],
  source_funnel  TEXT,
  captured_copy  TEXT,
  notes          TEXT,
  captured_at    DATE
);

CREATE INDEX IF NOT EXISTS lead_magnets_competitor ON lead_magnets(competitor_id);

-- =============================================================
-- OFFERS (paid programs with Hormozi Grand Slam scoring)
-- =============================================================
CREATE TABLE IF NOT EXISTS offers (
  id                    SERIAL PRIMARY KEY,
  competitor_id         TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  name                  TEXT,
  url                   TEXT,
  category              TEXT,                           -- see packages/shared/src/taxonomy.ts OFFER_CATEGORIES — generic vocabulary
  price_anchor          NUMERIC,
  price_actual          NUMERIC,
  currency              TEXT DEFAULT 'USD',
  duration              TEXT,
  format                TEXT,                           -- online | in-person | hybrid
  delivery_summary      TEXT,
  bonuses               JSONB,                          -- [{name, value, included}, ...]
  guarantee             TEXT,
  scarcity              TEXT,

  -- Hormozi Grand Slam dimensions (1-10 each)
  grand_slam_dream      INTEGER CHECK (grand_slam_dream      BETWEEN 1 AND 10),
  grand_slam_likelihood INTEGER CHECK (grand_slam_likelihood BETWEEN 1 AND 10),
  grand_slam_time       INTEGER CHECK (grand_slam_time       BETWEEN 1 AND 10),
  grand_slam_effort     INTEGER CHECK (grand_slam_effort     BETWEEN 1 AND 10),
  grand_slam_total      INTEGER GENERATED ALWAYS AS (
    COALESCE(grand_slam_dream,0) + COALESCE(grand_slam_likelihood,0) +
    COALESCE(grand_slam_time,0)  + COALESCE(grand_slam_effort,0)
  ) STORED,

  notes                 TEXT,
  captured_at           DATE
);

CREATE INDEX IF NOT EXISTS offers_competitor ON offers(competitor_id);
CREATE INDEX IF NOT EXISTS offers_category   ON offers(category);

-- =============================================================
-- PUBLIC_MENTIONS (press, podcasts, awards, speaking)
-- =============================================================
CREATE TABLE IF NOT EXISTS public_mentions (
  id             SERIAL PRIMARY KEY,
  competitor_id  TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  mention_type   TEXT,                                  -- podcast | press | youtube-feature | book | award | speaking
  title          TEXT,
  url            TEXT,
  date           DATE,
  outlet         TEXT,
  reach_estimate INTEGER,
  notes          TEXT
);

CREATE INDEX IF NOT EXISTS public_mentions_competitor ON public_mentions(competitor_id);

-- =============================================================
-- DOSSIER_SECTIONS (auto-generated narrative reports, one per section)
-- =============================================================
CREATE TABLE IF NOT EXISTS dossier_sections (
  id               SERIAL PRIMARY KEY,
  competitor_id    TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  section_slug     TEXT NOT NULL,                      -- funnel | offers | lead-magnets | positioning | distribution | summary
  markdown         TEXT,
  word_count       INTEGER,
  generated_by     TEXT,                               -- claude-opus-4-7 | manual | seed
  generated_at     TIMESTAMPTZ DEFAULT NOW(),
  cache_expires_at TIMESTAMPTZ,
  UNIQUE (competitor_id, section_slug)
);

-- =============================================================
-- ANALYSES (framework-driven strategic reports, on-demand)
-- =============================================================
CREATE TABLE IF NOT EXISTS analyses (
  id            SERIAL PRIMARY KEY,
  -- Nullable: a run-level cross-competitor synthesis (replacing the old
  -- hardcoded GAPS/TEMP_INSIGHTS arrays in app/patterns/page.tsx) has no
  -- single competitor — it belongs to the run instead.
  competitor_id TEXT REFERENCES competitors(id) ON DELETE CASCADE,
  run_id        TEXT REFERENCES runs(id) ON DELETE CASCADE,
  framework     TEXT NOT NULL,                          -- brunson-funnel | hormozi-grand-slam | hormozi-value-equation | dream-100 | mckinsey-pyramid | challenger-recommendation
  scope         TEXT,                                   -- whole-org | specific-funnel | specific-offer | cross-competitor
  scope_ref     TEXT,
  markdown      TEXT,
  scores        JSONB,
  generated_by  TEXT,
  generated_at  TIMESTAMPTZ DEFAULT NOW(),
  CHECK (competitor_id IS NOT NULL OR run_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS analyses_competitor_framework ON analyses(competitor_id, framework);
CREATE INDEX IF NOT EXISTS analyses_run ON analyses(run_id);

-- =============================================================
-- SCRAPE_JOBS (audit log for the pipeline)
-- =============================================================
CREATE TABLE IF NOT EXISTS scrape_jobs (
  id             SERIAL PRIMARY KEY,
  competitor_id  TEXT REFERENCES competitors(id) ON DELETE SET NULL,
  run_id         TEXT REFERENCES runs(id) ON DELETE SET NULL,
  kind           TEXT,                                  -- discovery | ads | funnel | classify
  trigger        TEXT,                                  -- add-competitor | weekly-cron | manual-refresh | run
  sources        TEXT[],
  status         TEXT,                                  -- queued | running | partial | ok | failed
  started_at     TIMESTAMPTZ DEFAULT NOW(),
  finished_at    TIMESTAMPTZ,
  records_added  JSONB,                                 -- {ads: 11, lead_magnets: 2, ...}
  cost_units     JSONB,                                 -- {firecrawl_credits: N, claude_calls: N, claude_tokens: N}
  errors         JSONB,
  inngest_run_id TEXT                                   -- vestigial, kept so old rows still deserialize; unused going forward
);

CREATE INDEX IF NOT EXISTS scrape_jobs_competitor ON scrape_jobs(competitor_id);
CREATE INDEX IF NOT EXISTS scrape_jobs_run        ON scrape_jobs(run_id);
CREATE INDEX IF NOT EXISTS scrape_jobs_status     ON scrape_jobs(status);

-- =============================================================
-- AUTH_ALLOWLIST (Google OAuth allowlist for the admin app)
-- =============================================================
CREATE TABLE IF NOT EXISTS auth_allowlist (
  id         SERIAL PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  role       TEXT DEFAULT 'viewer',                    -- admin | editor | viewer
  added_at   TIMESTAMPTZ DEFAULT NOW(),
  added_by   TEXT
);

-- Seed the first admin. Replace the placeholder with your own Google account
-- email before running this schema — this is what gates access to /login.
INSERT INTO auth_allowlist (email, role, added_by)
VALUES ('your-email@example.com', 'admin', 'seed')
ON CONFLICT (email) DO NOTHING;

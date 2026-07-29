# Schema Field Reference

Human-readable companion to `schema.sql`. Use this when designing UIs, generating dossier sections, or writing scrape parsers.

---

## `competitors`

| Field | Type | Meaning | Notes |
|---|---|---|---|
| `id` | TEXT | Slug (e.g. `kadampa-deuachen`) | Lowercase, kebab-case |
| `name` | TEXT | Display name | "Centro de Meditação Kadampa Deuachen" |
| `status` | TEXT | `active` \| `archived` \| `wip` | wip = scrape running |
| `primary_site_url` | TEXT | Canonical homepage | The one true URL |
| `founder` | TEXT | Founder name | "Paramahamsa Vishwananda" |
| `founder_alive` | BOOLEAN | Is the founder a living, active figure? | Determines Attractive Character strategy |
| `hq_country` | TEXT | ISO country | "PT", "IN", "DE" |
| `hq_city` | TEXT | City | "Sintra" |
| `org_type` | TEXT | Spiritual tradition | tibetan-buddhist \| hindu-devotional \| yogic-science \| classical-yoga \| breath-wellness \| unknown |
| `org_size_estimate` | TEXT | Scale | single-center \| regional \| national \| global \| mega-global |
| `archetype` | TEXT | Brand archetype | sage \| reluctant-hero \| adventurer \| avatar \| warrior |
| `attractive_character_name` | TEXT | Living face for the brand | NULL if founder is deceased and no successor |
| `attractive_character_alive` | BOOLEAN | Is the face currently active? | |
| `voice_descriptor` | TEXT | Tone of voice | "calm-authoritative", "warm-secular", "devotional-emotional" |
| `audience_target` | TEXT | Who they pitch to | "stressed-professionals", "spiritual-seekers", "wellness-tourists" |
| `positioning_notes` | TEXT | Free-form additional positioning context | LLM-generated, editable |
| `one_line_summary` | TEXT | 1-sentence positioning | "A Tibetan Buddhist temple in Sintra running tourism-as-Trojan-horse Meta ads to convert weekend visitors into community members." |
| `ad_strategy` | TEXT | One of 7 strategy archetypes | See plan §"Ad-strategy archetypes" |
| `value_ladder` | JSONB | Tiered offers | `[{rung: 1, offer: "Free 30-min meditations", price: "free", type: "intro"}, ...]` |
| `funnel_archetype` | TEXT | Brunson 7-funnel type | opt-in \| webinar \| application \| bridge \| continuity \| summit |

---

## `intel_sources`

External handles/URLs per competitor, used by the scraper to know what to crawl.

| Field | Meaning |
|---|---|
| `source_type` | website \| meta_page \| instagram \| youtube_channel \| linkedin_company \| tiktok \| podcast \| google_business |
| `url` | Full URL of the external profile |
| `handle` | @-handle if applicable |
| `scrape_strategy` | Which scraper handles this URL |
| `is_canonical` | TRUE = primary instance of this source_type (one per type max) |

---

## `ads`

One row per Meta Ad Library result. Schema is platform-agnostic to allow future Google/LinkedIn ads.

Key fields:
- `library_id`: Meta's Ad Library ID (the canonical key from Meta)
- `id`: composed as `<competitor_id>-<library_id>` for joins
- `is_evergreen_winner`: TRUE when `duration_days >= 100` (proven profitable on Meta's economics)
- `hook_angle`: classified by LLM. Current values: tourism, curiosity, identity, authority-quote, religious-curiosity, emotional, direct, quiz
- `traffic_temperature`: cold (doesn't know meditation is the answer) \| warm (curious) \| hot (already considering) \| believer (already in the tradition)
- `raw_scrape_md`: stored verbatim so we can re-parse if classifiers improve

---

## `funnel_steps`

Page-by-page sequence inferred from a website crawl + ad → landing → next-step traversal.

A `funnel_name` groups steps (e.g. `inner-engineering-online`). `step_index` orders them.

`step_role` values: ad, bridge, opt-in, sales, order-bump, upsell, thank-you, continuity (Brunson taxonomy).

---

## `lead_magnets`

Free offers used to capture leads. `magnet_type`: pdf, course, quiz, webinar, tool, template, newsletter, free-session.

`promise` is what they claim it delivers (the hook text). `captured_copy` is the LP body verbatim, useful when generating AM's own magnets.

---

## `offers`

Paid programs with Hormozi Grand Slam scoring built in. Each of the 4 dimensions (Dream, Likelihood, Time, Effort) is 1-10. `grand_slam_total` is auto-summed (max 40).

`bonuses` JSONB shape: `[{name, value, included}]`.

`category`: intro (paid intro program), flagship (the main thing), retreat, ttc (teacher training), continuity (recurring), advanced.

---

## `public_mentions`

Press, podcasts, awards, speaking gigs. Builds the Dream 100 picture — who's in their distribution network.

---

## `dossier_sections`

Auto-generated narrative markdown per section. One row per (competitor, section_slug) — UPSERT on regeneration.

`section_slug` values: funnel, offers, lead-magnets, positioning, distribution, summary.

These are the readable reports the public viewer renders alongside structured data.

---

## `analyses`

Framework-driven on-demand reports. Each one is a specific framework applied to a specific scope.

Frameworks for v1:
- `brunson-funnel` — 8-element breakdown + Linchpin gap analysis
- `hormozi-grand-slam` — score the flagship offer's 4 dimensions, identify the weakest link
- `hormozi-value-equation` — apply the value equation formula
- `dream-100` — who's in their distribution network, where AM should be too
- `mckinsey-pyramid` — situation → complication → resolution structure for the why-they-win narrative
- `challenger-recommendation` — what a challenger should do, given this competitor's data

`scores` JSONB stores framework-specific numeric output (e.g. the 4 Grand Slam scores).

---

## `scrape_jobs`

Audit log. Every pipeline run creates a row. `records_added` JSONB tracks counts per source: `{ads: 11, lead_magnets: 2, public_mentions: 4}`.

`status`: queued (just enqueued) → running → ok/partial/failed.

---

## `runs`

A niche+country benchmark request — see README.md for the discovery pipeline this drives.

`status`: queued → discovering → classifying → scraping → funnels → ready \| failed \| no_competitors_found.
`niche_key`: normalized `niche_label`, used to find a cached run for the same niche+country within `RUN_CACHE_DAYS`.

---

## `run_competitors`

N:N between a run and a competitor — a competitor can surface in more than one run's niche/keywords. `included = false` rows are kept for audit (ranked below the cap, not dropped).

---

## `discovery_candidates`

The filter's full audit trail for one run — every page the keyword search surfaced, whether accepted or rejected, and why (`verdict`). This is what the admin's "Filtered out" panel reads.

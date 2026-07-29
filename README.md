# Radar da Concorrência

Competitor-intelligence dossier system for any niche: point it at a market ("clínicas dentárias, PT"), it finds who's advertising on Meta, and builds a dossier per competitor (ads, funnel, offers, positioning), backed by Brunson/Hormozi coaching frameworks.

> Forked from a single-client tool originally built for a yoga/wellness org. This fork is being generalized so anyone can clone it, point it at their own niche, and run it with their own API keys — automatic competitor discovery instead of adding competitors by hand. In-progress; see Status below.

## What this is

- **Ads** — paid Meta ad history per competitor
- **Funnels** — page-by-page sequence inferred from a website crawl
- **Lead Magnets** — free offers with capture copy
- **Offers** — paid programs with prices, bonuses, guarantees, Hormozi Grand Slam scores
- **Positioning** — value ladder, archetype, voice, audience
- **Framework Analyses** — Brunson Funnel breakdown, Hormozi Grand Slam scoring, Dream 100 audit, on-demand strategy recommendation

## Architecture

- **Admin app** (`apps/admin/`) — Next.js + Vercel, the only UI. **No login** — anyone who can reach the URL can use it. If you deploy this anywhere beyond your own machine, put it behind something that gates access yourself (a VPN, Vercel deployment protection, a reverse proxy with basic auth).
- **Worker** (`apps/worker/`) — Express service on Railway; runs the discovery pipeline (keyword expansion → Meta Ad Library search → spam filter → LLM relevance pass → auto-create competitors → scrape ad history → classify hooks → crawl funnels → synthesize value ladder/positioning) and exposes it as `POST /run`.
- **`packages/shared/`** — the generic hook/temperature/offer taxonomy and discovery-filter logic, used by both apps.
- **Neon Postgres** — single source of truth, schema in `data/schema.sql`.

## Repo layout

```
radar-da-concorrencia/
├── apps/admin/       # Next.js admin app (UI, Claude analysis calls)
├── apps/worker/      # Railway worker: discovery pipeline + Meta Ad Library scraper
├── packages/shared/  # taxonomy + discovery-filter logic shared by both apps
├── data/
│   ├── schema.sql    # Neon schema
│   └── schema.md     # per-column reference
├── scripts/          # download-creatives (ad image mining)
└── skill-refs/       # vendored Brunson/Hormozi reference docs (generic marketing theory)
```

## Setup

1. Clone this repo.
2. Create a Neon Postgres database, run `data/schema.sql` against it.
3. Copy `.env.local.example` → `.env.local` in both `apps/admin/` and `apps/worker/`, fill in your own keys (Firecrawl, Anthropic, a random `WORKER_SECRET` shared by both apps).
4. `npm install` once at the repo root — this is an npm workspace, don't install per-app.
5. Run the worker (`npm run dev` in `apps/worker/`, Railway in prod) and the admin app (`npm run dev` in `apps/admin/`, Vercel in prod). Both need `packages/shared` built first — `npm run build` in each app handles that automatically; for local dev, run `npm run build -w @radar/shared` once after cloning.
6. Open the admin app, go to **Runs → New benchmark**, type a niche and country.

## Status

Forked from a working single-client tool (manual competitor entry only). The fork replaces that with automatic per-niche discovery — validated live end-to-end against a real Neon database across three PT niches (dental clinics, pilates studios, real estate agencies): keyword expansion → Ad Library search → spam/off-niche filtering → auto-created competitors → ad scraping → hook classification → funnel crawl → value-ladder/positioning synthesis, with real cost caps that abort a run before it runs away. The admin UI (`/runs`, `/runs/new`, `/runs/[id]`) exposes this end to end.

An independent readiness review (`docs/lead-magnet-readiness-report.md`) found real gaps before this is safe for a broad, non-technical giveaway — most importantly, generated Markdown is rendered without sanitization (a stored-XSS risk from scraped content) and a total provider outage can currently read as a legitimate "no competitors found" instead of a failure. See that doc for the full list before distributing this widely.

Not yet built: a public self-serve form (today someone has to open the admin and start a run themselves) and Graph API-based discovery (Meta's official Ad Library API, as an alternative to the Firecrawl-keyword-search branch this ships with — more coverage, no page-1-only sampling limit, but needs your own Meta app token).

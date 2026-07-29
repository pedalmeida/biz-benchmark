# biz-benchmark

Competitor-intelligence dossier system for any niche: point it at a market ("clínicas dentárias, PT"), it finds who's advertising on Meta, and builds a dossier per competitor (ads, funnel, offers, positioning), backed by Brunson/Hormozi coaching frameworks.

> Forked from a single-client tool originally built for a yoga/wellness org. This fork is being generalized so anyone can clone it, point it at their own niche, and run it with their own API keys — automatic competitor discovery instead of adding competitors by hand. In-progress; see Status below.

## What this is

- **Ads** — paid Meta ad history per competitor
- **Funnels** — page-by-page sequence inferred from a website crawl
- **Lead Magnets** — free offers with capture copy
- **Offers** — paid programs with prices, bonuses, guarantees, Hormozi Grand Slam scores
- **Positioning** — archetype, voice, audience
- **Framework Analyses** — Brunson Funnel breakdown, Hormozi Grand Slam scoring, Dream 100 audit, on-demand strategy recommendation

## Architecture

- **Admin app** (`apps/admin/`) — Next.js + Vercel + Google OAuth, the only UI
- **Worker** (`apps/worker/`) — small Express service on Railway; scrapes the Meta Ad Library via Firecrawl, parses results, writes to Postgres
- **Neon Postgres** — single source of truth, schema in `data/schema.sql`

## Repo layout

```
biz-benchmark/
├── apps/admin/     # Next.js admin app (UI, auth, Claude analysis calls)
├── apps/worker/    # Railway worker: scrapes + parses the Meta Ad Library
├── data/
│   ├── schema.sql  # Neon schema
│   └── schema.md   # per-column reference
├── scripts/        # download-creatives (ad image mining)
└── skill-refs/     # vendored Brunson/Hormozi reference docs (generic marketing theory)
```

## Setup

1. Clone this repo.
2. Create a Neon Postgres database, run `data/schema.sql` against it — **first edit the seed email near the bottom of that file** to your own Google account email (it gates `/login`).
3. Copy `.env.local.example` → `.env.local` in both `apps/admin/` and `apps/worker/`, fill in your own keys (Firecrawl, Anthropic, Google OAuth, a random `WORKER_SECRET` shared by both apps).
4. `npm install` in `apps/admin/` and `apps/worker/` separately.
5. Run the worker (`npm run dev`, Railway in prod) and the admin app (`npm run dev`, Vercel in prod).

## Status

Forked from a working single-client tool. What's proven: Meta Ad Library keyword-search discovery works (validated against a Portuguese dental-clinic niche pilot — real competitors surface, with a spam/irrelevant-page filter needed on top). What's in progress: automatic competitor discovery + generic (non-hardcoded-vertical) taxonomy and prompts, so the tool works for any niche out of the box. See `docs/` for the design doc once it lands.

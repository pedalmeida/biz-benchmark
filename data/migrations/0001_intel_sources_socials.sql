-- Migration 0001 — extend intel_sources with social/follower fields
--
-- Backs the dashboard "socials" pills + per-competitor Overview > Socials.
-- Run once against the live DB. Idempotent — safe to re-run.

ALTER TABLE intel_sources
  ADD COLUMN IF NOT EXISTS follower_count INTEGER,
  ADD COLUMN IF NOT EXISTS display_name   TEXT,
  ADD COLUMN IF NOT EXISTS verified_at    TIMESTAMPTZ;

COMMENT ON COLUMN intel_sources.follower_count IS
  'Followers / subscribers — null if not collected. Manually seeded for v1; worker will refresh later.';
COMMENT ON COLUMN intel_sources.display_name IS
  'Account display name (different from handle). Optional.';
COMMENT ON COLUMN intel_sources.verified_at IS
  'When follower_count was last confirmed. Null = never verified.';

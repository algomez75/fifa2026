-- 029_match_delay.sql — surface delayed / postponed / suspended / cancelled
-- matches and let sync-scores refresh a rescheduled kickoff while keeping the
-- original. ADDITIVE: `status` stays 'scheduled'|'live'|'finished' so every
-- existing filter (which relies on those three values) is unaffected; the new
-- timing state rides in a separate nullable column.
--
-- football-data.org v4 gives POSTPONED / SUSPENDED / CANCELLED as first-class
-- statuses and updates `utcDate` in place on a reschedule (no original/new pair).
-- "delayed" (running late) is inferred by sync-scores (past kickoff, not started).

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS delay_status TEXT
    CHECK (delay_status IN ('delayed', 'postponed', 'suspended', 'cancelled')),
  ADD COLUMN IF NOT EXISTS original_kickoff_utc TIMESTAMPTZ;

COMMENT ON COLUMN matches.delay_status IS
  'Non-normal timing state (football-data): delayed (past kickoff, not started) / postponed / suspended (mid-play, score frozen) / cancelled. NULL = normal. status stays scheduled|live|finished — set only by the service-role sync.';
COMMENT ON COLUMN matches.original_kickoff_utc IS
  'kickoff_utc before a reschedule (snapshot once when football-data moves utcDate), so the app can show "moved from X".';

-- matches is already in supabase_realtime (migration 005) + public-read (007) +
-- writes locked to the service-role cron (008); new columns inherit all of that.

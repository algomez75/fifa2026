-- 025_faster_live_sync.sql — tighten the live score-sync cadence.
--
-- sync-scores self-guards (no-op outside a match's in-progress window), so
-- running it every ~20s instead of every 60s only adds load while a match is
-- actually live. Combined with the new inline goal push (sync-scores sends the
-- "GOAL" notification itself instead of waiting for the notify-dispatcher cron),
-- this cuts goal detection + push latency from up to ~2 min down to ~10-20s.
--
-- pg_cron (>= 1.5, which Supabase runs) supports sub-minute 'N seconds'
-- schedules. notify-dispatcher stays at 1 min: it is now only the goal backstop
-- plus kickoff / lineup / full-time / challenge alerts, none second-sensitive.

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'wc26-sync-scores'),
  schedule := '20 seconds'
);

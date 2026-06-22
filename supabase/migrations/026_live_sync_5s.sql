-- 026_live_sync_5s.sql — push the live score-sync cadence to ~5s.
--
-- sync-scores v3 makes the high-frequency path CHEAP: the single
-- `/competitions/WC/matches` LIST call (1 request) carries score + minute +
-- period + half-time score for every match, and the loop now writes a row only
-- when something actually changed (no per-tick churn on finished matches). The
-- expensive per-match `/matches/{id}` DETAIL fetch is gated (on a score change /
-- kickoff, while a scorer is unattributed, or every DETAIL_FLOOR ms) so detail
-- cost does NOT scale with cadence and player paging is lazy. Net: clock / score
-- / half-time refresh ~5s at ~the same football-data request volume as 20s.
--
-- The function also emits live-moment pushes (kickoff / half-time / second-half)
-- and is 429-aware (one bounded retry; a long Retry-After sheds the detail loop).
--
-- Rollback: re-run with schedule := '20 seconds' (instant, no redeploy).

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'wc26-sync-scores'),
  schedule := '5 seconds'
);

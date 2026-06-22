-- 027_dispatcher_30s.sql — halve the notify-dispatcher cadence to ~30s.
--
-- The dispatcher is now only a backstop: sync-scores (every ~5s) sends goal +
-- live-moment pushes inline. Running the dispatcher every 30s instead of 60s
-- mainly halves the latency of the goal BACKSTOP (goals sync-scores genuinely
-- missed) and the full-time result push. Every push type is idempotently deduped
-- (push_sent / match_events.pushed / matches.result_pushed / AM-PM bucket) and the
-- reminder scans are tiny, so the faster cadence can't double-send and adds
-- negligible load.
--
-- Rollback: re-run with schedule := '* * * * *' (every minute).

SELECT cron.alter_job(
  (SELECT jobid FROM cron.job WHERE jobname = 'wc26-notify-dispatcher'),
  schedule := '30 seconds'
);

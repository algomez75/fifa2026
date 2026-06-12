-- 020_push_for_all.sql — ESPN-style notifications for every installed app.
--
-- 1. notify_all becomes opt-OUT: new users get tournament-wide pushes by
--    default, and existing rows are flipped on (users can still disable in
--    their settings).
-- 2. push_log gives the dispatcher a robust per-user/per-match/per-type dedupe
--    so kickoff alerts fire exactly once even if a cron tick is missed or
--    runs late (the old one-minute window silently dropped them).

ALTER TABLE user_settings ALTER COLUMN notify_all SET DEFAULT true;
UPDATE user_settings SET notify_all = true;

CREATE TABLE IF NOT EXISTS push_log (
  user_id    UUID NOT NULL,
  match_id   TEXT NOT NULL,
  type       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, match_id, type)
);

-- Service-role only: RLS on with no policies.
ALTER TABLE push_log ENABLE ROW LEVEL SECURITY;

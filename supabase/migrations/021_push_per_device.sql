-- 021_push_per_device.sql — fix the duplicate-push bug.
--
-- Root cause: anonymous-first auth creates a fresh user on every sign-out, and
-- each registers the SAME physical device's Expo token. One phone ended up on
-- 28 user_settings rows, and the dispatcher sent one push PER ROW → 28 copies.
--
-- Fix: the dispatcher now sends one push per UNIQUE TOKEN and dedupes
-- time-window alerts (lineup, kickoff) per (token, match, type) here — the old
-- push_log keyed by user_id couldn't dedupe across the shared-token rows.

CREATE TABLE IF NOT EXISTS push_sent (
  token      TEXT NOT NULL,
  match_id   TEXT NOT NULL,
  type       TEXT NOT NULL,   -- 'lineup' | 'kickoff'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (token, match_id, type)
);

-- Service-role only: RLS on with no policies.
ALTER TABLE push_sent ENABLE ROW LEVEL SECURITY;

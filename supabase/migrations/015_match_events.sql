-- 015_match_events.sql — per-goal events (scorer, minute) + full-time push dedupe.
--
-- `match_events` rows are written ONLY by the sync-scores edge function
-- (service role) from football-data.org's per-match `goals[]` array. The app
-- reads them via Realtime INSERTs to show "GOAL — <player> <minute>'" and the
-- notify-dispatcher pushes each unpushed goal once.

CREATE TABLE IF NOT EXISTS match_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  -- Index of the goal in football-data's goals[] array — idempotency key, so
  -- re-syncing a match never duplicates events.
  seq         INTEGER NOT NULL,
  type        TEXT NOT NULL DEFAULT 'goal',
  minute      INTEGER,
  team_id     TEXT REFERENCES teams(id),
  player_name TEXT,
  score_home  INTEGER,
  score_away  INTEGER,
  pushed      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, seq)
);

CREATE INDEX IF NOT EXISTS match_events_unpushed_idx
  ON match_events (pushed) WHERE NOT pushed;

-- Public tournament data: anyone can read; only the service role writes
-- (no insert/update policies on purpose).
ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_events_public_read" ON match_events
  FOR SELECT USING (true);

-- Realtime: the app subscribes to INSERTs for live goal celebrations.
ALTER PUBLICATION supabase_realtime ADD TABLE match_events;

-- Robust dedupe for the "Full time" push (replaces the fragile 90s
-- updated_at window, which would re-fire on late score backfills).
ALTER TABLE matches ADD COLUMN IF NOT EXISTS result_pushed BOOLEAN NOT NULL DEFAULT false;

-- Safety backfill: don't retro-push results for matches already finished
-- before this migration (e.g. GS-A1, whose null-score finish already pushed).
UPDATE matches SET result_pushed = true WHERE status = 'finished';

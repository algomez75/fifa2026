-- 018_stats.sql — tournament statistics unlocked by the paid football-data tier.
--
-- 1. Cards (yellow/red) ride on the existing match_events table as
--    type 'yellow' | 'red'; bookings use a seq namespace of 1000+ so they never
--    collide with goal seqs (0..99) under the (match_id, seq) unique key.
-- 2. top_scorers — the tournament's golden-boot table, replaced wholesale by
--    sync-scores from /competitions/WC/scorers after matches update.

CREATE TABLE IF NOT EXISTS top_scorers (
  rank        INTEGER PRIMARY KEY,
  fd_player_id INTEGER,
  player_id   INTEGER REFERENCES players(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  team_id     TEXT REFERENCES teams(id),
  goals       INTEGER NOT NULL DEFAULT 0,
  assists     INTEGER,
  penalties   INTEGER,
  played      INTEGER,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE top_scorers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "top_scorers_public_read" ON top_scorers
  FOR SELECT USING (true);

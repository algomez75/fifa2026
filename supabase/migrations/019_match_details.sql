-- 019_match_details.sql — per-match rich detail (lineups, formations, bench,
-- team statistics, referees, attendance) synced from football-data's match
-- endpoint by sync-scores. Kept OUT of the realtime publication on purpose:
-- the payloads are chunky and the detail screen polls instead.
--
-- `home_stats`/`away_stats` stay null until the football-data Stats-Package
-- add-on is active on the account; the app lights the bars up automatically.

CREATE TABLE IF NOT EXISTS match_details (
  match_id    TEXT PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  home_formation TEXT,
  away_formation TEXT,
  home_lineup JSONB,   -- [{name, position, shirtNumber, fd_id, player_id, photo}]
  away_lineup JSONB,
  home_bench  JSONB,
  away_bench  JSONB,
  home_stats  JSONB,   -- {ball_possession, shots, shots_on_goal, ...} when available
  away_stats  JSONB,
  substitutions JSONB, -- [{minute, team_id, out_name, in_name}]
  referee     TEXT,
  attendance  INTEGER,
  injury_time INTEGER,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE match_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_details_public_read" ON match_details
  FOR SELECT USING (true);

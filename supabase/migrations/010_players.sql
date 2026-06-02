-- 010_players.sql — squads (26 players per team) + team metadata.

CREATE TABLE IF NOT EXISTS players (
  id            SERIAL PRIMARY KEY,
  team_id       TEXT REFERENCES teams(id) ON DELETE CASCADE,
  fd_player_id  INTEGER,
  name          TEXT NOT NULL,
  position      TEXT,              -- Goalkeeper | Defence | Midfield | Offence
  date_of_birth DATE,
  nationality   TEXT,
  shirt_number  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_players_team ON players (team_id);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read players" ON players;
CREATE POLICY "public read players" ON players FOR SELECT USING (true);

-- team metadata from football-data.org
ALTER TABLE teams ADD COLUMN IF NOT EXISTS crest_url   TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS coach       TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS fd_team_id  INTEGER;

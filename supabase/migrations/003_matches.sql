-- 003_matches.sql — 104 tournament matches
CREATE TABLE IF NOT EXISTS matches (
  id                     TEXT PRIMARY KEY,  -- e.g. "GS-A1", "R32-1", "FINAL-1"
  stage                  TEXT NOT NULL,     -- group, r32, r16, qf, sf, third, final
  group_letter           CHAR(1),
  match_number           INTEGER,
  home_team_id           TEXT REFERENCES teams(id),
  away_team_id           TEXT REFERENCES teams(id),
  home_placeholder       TEXT,              -- e.g. "Winner Group A" (knockout TBD)
  away_placeholder       TEXT,
  home_score             INTEGER,
  away_score             INTEGER,
  home_score_penalties   INTEGER,
  away_score_penalties   INTEGER,
  status                 TEXT DEFAULT 'scheduled',  -- scheduled, live, finished
  kickoff_utc            TIMESTAMPTZ NOT NULL,
  venue_id               TEXT REFERENCES venues(id),
  api_football_fixture_id INTEGER,
  minute                 INTEGER,
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_kickoff ON matches (kickoff_utc);
CREATE INDEX IF NOT EXISTS idx_matches_status  ON matches (status);
CREATE INDEX IF NOT EXISTS idx_matches_group   ON matches (group_letter);
CREATE INDEX IF NOT EXISTS idx_matches_stage   ON matches (stage);

-- keep updated_at fresh on every write
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_matches_updated ON matches;
CREATE TRIGGER trg_matches_updated
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

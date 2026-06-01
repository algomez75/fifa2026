-- 001_teams.sql — 48 national teams
CREATE TABLE IF NOT EXISTS teams (
  id              TEXT PRIMARY KEY,        -- e.g. "usa", "mex", "bra"
  name            TEXT NOT NULL,
  name_es         TEXT,
  flag_emoji      TEXT,
  iso2            TEXT,                     -- ISO 3166-1 alpha-2 (flag rendering)
  group_letter    CHAR(1),
  host_country    BOOLEAN DEFAULT false,
  api_football_id INTEGER,
  confederation   TEXT                      -- UEFA, CONMEBOL, CONCACAF, CAF, AFC, OFC
);

CREATE INDEX IF NOT EXISTS idx_teams_group ON teams (group_letter);

-- 005_historical.sql — past World Cups (1930–2022)
CREATE TABLE IF NOT EXISTS historical_editions (
  year         INTEGER PRIMARY KEY,
  host         TEXT,
  champion     TEXT,
  runner_up    TEXT,
  third_place  TEXT,
  total_goals  INTEGER,
  total_teams  INTEGER,
  final_score  TEXT,
  top_scorer   TEXT
);

CREATE TABLE IF NOT EXISTS historical_matches (
  id         SERIAL PRIMARY KEY,
  year       INTEGER REFERENCES historical_editions(year),
  stage      TEXT,
  home_team  TEXT,
  away_team  TEXT,
  home_score INTEGER,
  away_score INTEGER,
  venue      TEXT,
  match_date DATE
);

CREATE INDEX IF NOT EXISTS idx_historical_matches_year ON historical_matches (year);

-- enable realtime broadcast of live score updates to clients
ALTER PUBLICATION supabase_realtime ADD TABLE matches;

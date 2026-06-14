-- 023_more_coverage.sql
-- Surface the extra data the football-data Stats-Package + paid tier already
-- return but the app didn't store/show yet:
--   1) half-time score per match (self-backfills via the sync-scores list loop),
--   2) the full referee crew per match (main + assistants + nationality),
--   3) official group standings (correct FIFA tiebreaks + recent form), synced
--      from /competitions/WC/standings.

-- 1) Half-time score (the list endpoint carries score.halfTime for every match).
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_score_ht INT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_score_ht INT;

-- 2) Full referee crew: [{name, type, nationality}, ...].
ALTER TABLE match_details ADD COLUMN IF NOT EXISTS referees JSONB;

-- 3) Official group standings (service-role writes only; public read).
CREATE TABLE IF NOT EXISTS standings (
  group_letter    TEXT NOT NULL,
  team_id         TEXT NOT NULL REFERENCES teams(id),
  position        INT  NOT NULL,
  played          INT  NOT NULL DEFAULT 0,
  won             INT  NOT NULL DEFAULT 0,
  draw            INT  NOT NULL DEFAULT 0,
  lost            INT  NOT NULL DEFAULT 0,
  goals_for       INT  NOT NULL DEFAULT 0,
  goals_against   INT  NOT NULL DEFAULT 0,
  goal_difference INT  NOT NULL DEFAULT 0,
  points          INT  NOT NULL DEFAULT 0,
  form            TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_letter, team_id)
);
ALTER TABLE standings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "standings_public_read" ON standings;
CREATE POLICY "standings_public_read" ON standings FOR SELECT USING (true);

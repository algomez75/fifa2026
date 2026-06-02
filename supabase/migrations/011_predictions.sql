-- 011_predictions.sql — Phase 2: per-user score predictions + leaderboard.

CREATE TABLE IF NOT EXISTS predictions (
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id   TEXT REFERENCES matches(id) ON DELETE CASCADE,
  home_pred  INTEGER NOT NULL CHECK (home_pred >= 0 AND home_pred <= 30),
  away_pred  INTEGER NOT NULL CHECK (away_pred >= 0 AND away_pred <= 30),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, match_id)
);

ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- A user reads/writes only their own predictions, and may only create/edit a
-- prediction BEFORE the match kicks off (fairness).
DROP POLICY IF EXISTS "owner reads predictions" ON predictions;
CREATE POLICY "owner reads predictions" ON predictions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner writes predictions" ON predictions;
CREATE POLICY "owner writes predictions" ON predictions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (SELECT kickoff_utc FROM matches WHERE id = match_id) > NOW()
  );

DROP POLICY IF EXISTS "owner updates predictions" ON predictions;
CREATE POLICY "owner updates predictions" ON predictions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (SELECT kickoff_utc FROM matches WHERE id = match_id) > NOW()
  );

DROP TRIGGER IF EXISTS trg_predictions_updated ON predictions;
CREATE TRIGGER trg_predictions_updated
  BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Public leaderboard: aggregate points per user WITHOUT exposing individual
-- predictions. SECURITY DEFINER so it can read all predictions, but it only
-- returns totals + public profile fields.
--   exact score = 3 pts · correct result (W/D/L) = 1 pt · else 0
CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
  user_id      UUID,
  display_name TEXT,
  avatar_url   TEXT,
  points       INTEGER,
  predicted    INTEGER,
  exact        INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pr.user_id,
    COALESCE(prof.display_name, 'Player') AS display_name,
    prof.avatar_url,
    COALESCE(SUM(
      CASE
        WHEN m.status = 'finished'
          AND pr.home_pred = m.home_score AND pr.away_pred = m.away_score THEN 3
        WHEN m.status = 'finished'
          AND SIGN(pr.home_pred - pr.away_pred) = SIGN(m.home_score - m.away_score) THEN 1
        ELSE 0
      END
    ), 0)::INTEGER AS points,
    COUNT(*) FILTER (WHERE m.status = 'finished')::INTEGER AS predicted,
    COUNT(*) FILTER (
      WHERE m.status = 'finished'
        AND pr.home_pred = m.home_score AND pr.away_pred = m.away_score
    )::INTEGER AS exact
  FROM predictions pr
  JOIN matches m ON m.id = pr.match_id
  LEFT JOIN profiles prof ON prof.user_id = pr.user_id
  GROUP BY pr.user_id, prof.display_name, prof.avatar_url
  ORDER BY points DESC, exact DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO anon, authenticated;

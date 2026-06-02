-- 012_leaderboard_v2.sql — add total predictions to the leaderboard, and a
-- function to read a user's predictions (others' picks hidden until kickoff).

-- get_leaderboard now also returns `total` = ALL predictions made (any status),
-- so the "predictions made" counter updates the moment a user predicts.
DROP FUNCTION IF EXISTS public.get_leaderboard();
CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
  user_id      UUID,
  display_name TEXT,
  avatar_url   TEXT,
  points       INTEGER,
  predicted    INTEGER,
  exact        INTEGER,
  total        INTEGER
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
    )::INTEGER AS exact,
    COUNT(*)::INTEGER AS total
  FROM predictions pr
  JOIN matches m ON m.id = pr.match_id
  LEFT JOIN profiles prof ON prof.user_id = pr.user_id
  GROUP BY pr.user_id, prof.display_name, prof.avatar_url
  ORDER BY points DESC, exact DESC, total DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO anon, authenticated;

-- Read a single user's predictions. Fair-play: another user's pick for a match
-- that HASN'T kicked off yet is hidden (returned NULL) so nobody can copy. The
-- owner always sees their own picks.
CREATE OR REPLACE FUNCTION public.get_user_predictions(target UUID)
RETURNS TABLE (
  match_id    TEXT,
  home_pred   INTEGER,
  away_pred   INTEGER,
  kickoff_utc TIMESTAMPTZ,
  status      TEXT,
  home_score  INTEGER,
  away_score  INTEGER,
  points      INTEGER,
  revealed    BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pr.match_id,
    CASE WHEN reveal.ok THEN pr.home_pred ELSE NULL END AS home_pred,
    CASE WHEN reveal.ok THEN pr.away_pred ELSE NULL END AS away_pred,
    m.kickoff_utc,
    m.status,
    m.home_score,
    m.away_score,
    CASE
      WHEN m.status = 'finished'
        AND pr.home_pred = m.home_score AND pr.away_pred = m.away_score THEN 3
      WHEN m.status = 'finished'
        AND SIGN(pr.home_pred - pr.away_pred) = SIGN(m.home_score - m.away_score) THEN 1
      ELSE 0
    END AS points,
    reveal.ok AS revealed
  FROM predictions pr
  JOIN matches m ON m.id = pr.match_id
  CROSS JOIN LATERAL (
    SELECT (pr.user_id = auth.uid() OR m.kickoff_utc <= NOW()) AS ok
  ) reveal
  WHERE pr.user_id = target
  ORDER BY m.kickoff_utc ASC;
$$;
GRANT EXECUTE ON FUNCTION public.get_user_predictions(UUID) TO anon, authenticated;

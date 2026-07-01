-- 030_leaderboard_challenge_tiebreak.sql
-- Challenge points no longer inflate the global ranking total. They are still
-- accumulated per user (returned as `challenge_points`) and now serve ONLY as a
-- tiebreaker: when two users have the same prediction points, whoever has won
-- more head-to-head challenge points ranks higher. This keeps the public ranking
-- a pure measure of prediction skill while still rewarding challenge wins as the
-- deciding edge in a tie.
--
-- Reversible: redeploy the 013 definition (points = pred + challenge) to restore.

DROP FUNCTION IF EXISTS public.get_leaderboard();
CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
  user_id UUID, display_name TEXT, avatar_url TEXT,
  points INTEGER, predicted INTEGER, exact INTEGER, total INTEGER, challenge_points INTEGER
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH pred AS (
    SELECT pr.user_id,
      SUM(CASE
        WHEN m.status='finished' AND pr.home_pred=m.home_score AND pr.away_pred=m.away_score THEN 3
        WHEN m.status='finished' AND SIGN(pr.home_pred-pr.away_pred)=SIGN(m.home_score-m.away_score) THEN 1
        ELSE 0 END)::INT AS pred_points,
      COUNT(*) FILTER (WHERE m.status='finished')::INT AS predicted,
      COUNT(*) FILTER (WHERE m.status='finished' AND pr.home_pred=m.home_score AND pr.away_pred=m.away_score)::INT AS exact,
      COUNT(*)::INT AS total
    FROM predictions pr JOIN matches m ON m.id=pr.match_id
    GROUP BY pr.user_id
  ),
  chal AS (
    SELECT uid AS user_id, SUM(pts)::INT AS chal_points FROM (
      SELECT c.challenger_id AS uid,
        CASE WHEN public.ch_dist(c.challenger_side,c.challenger_margin,m.home_score,m.away_score)
                < public.ch_dist(c.opponent_side,c.opponent_margin,m.home_score,m.away_score) THEN 3
             WHEN public.ch_dist(c.challenger_side,c.challenger_margin,m.home_score,m.away_score)
                = public.ch_dist(c.opponent_side,c.opponent_margin,m.home_score,m.away_score) THEN 1
             ELSE 0 END AS pts
      FROM challenges c JOIN matches m ON m.id=c.match_id
      WHERE c.status='accepted' AND m.status='finished'
      UNION ALL
      SELECT c.opponent_id AS uid,
        CASE WHEN public.ch_dist(c.opponent_side,c.opponent_margin,m.home_score,m.away_score)
                < public.ch_dist(c.challenger_side,c.challenger_margin,m.home_score,m.away_score) THEN 3
             WHEN public.ch_dist(c.opponent_side,c.opponent_margin,m.home_score,m.away_score)
                = public.ch_dist(c.challenger_side,c.challenger_margin,m.home_score,m.away_score) THEN 1
             ELSE 0 END AS pts
      FROM challenges c JOIN matches m ON m.id=c.match_id
      WHERE c.status='accepted' AND m.status='finished'
    ) z GROUP BY uid
  ),
  ids AS (SELECT user_id FROM pred UNION SELECT user_id FROM chal)
  SELECT
    i.user_id,
    COALESCE(prof.display_name,'Player') AS display_name,
    prof.avatar_url,
    -- points = prediction points ONLY (challenge points excluded from the total)
    COALESCE(pred.pred_points,0)::INT AS points,
    COALESCE(pred.predicted,0)::INT AS predicted,
    COALESCE(pred.exact,0)::INT AS exact,
    COALESCE(pred.total,0)::INT AS total,
    COALESCE(chal.chal_points,0)::INT AS challenge_points
  FROM ids i
  LEFT JOIN pred ON pred.user_id=i.user_id
  LEFT JOIN chal ON chal.user_id=i.user_id
  LEFT JOIN profiles prof ON prof.user_id=i.user_id
  -- Tiebreak order: prediction points → challenge points (head-to-head edge)
  -- → exact scores → predictions made.
  ORDER BY points DESC, challenge_points DESC, exact DESC, total DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO anon, authenticated;

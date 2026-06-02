-- 013_challenges.sql — head-to-head challenges + in-app notifications.

-- ── helper functions: outcome side + distance ──────────────────────────────
-- side of a result: 'home' | 'away' | 'draw'
CREATE OR REPLACE FUNCTION public.ch_side(h INTEGER, a INTEGER)
RETURNS TEXT IMMUTABLE LANGUAGE sql AS $$
  SELECT CASE WHEN h > a THEN 'home' WHEN a > h THEN 'away' ELSE 'draw' END;
$$;

-- distance of a pick (side+margin) to an actual result (lower = closer).
-- Wrong winner is always worse than any correct-winner pick.
CREATE OR REPLACE FUNCTION public.ch_dist(side TEXT, margin INTEGER, h INTEGER, a INTEGER)
RETURNS INTEGER IMMUTABLE LANGUAGE sql AS $$
  SELECT CASE
    WHEN side = public.ch_side(h, a) THEN ABS(margin - ABS(h - a))
    ELSE 1000 + ABS(margin - ABS(h - a))
  END;
$$;

-- ── challenges ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS challenges (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id         TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  challenger_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenger_side  TEXT NOT NULL CHECK (challenger_side IN ('home','away','draw')),
  challenger_margin INTEGER NOT NULL CHECK (challenger_margin BETWEEN 0 AND 20),
  opponent_side    TEXT CHECK (opponent_side IN ('home','away','draw')),
  opponent_margin  INTEGER CHECK (opponent_margin BETWEEN 0 AND 20),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  CHECK (challenger_id <> opponent_id)
);
CREATE INDEX IF NOT EXISTS idx_challenges_opponent ON challenges (opponent_id);
CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON challenges (challenger_id);
CREATE INDEX IF NOT EXISTS idx_challenges_match ON challenges (match_id);

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "see own challenges" ON challenges;
CREATE POLICY "see own challenges" ON challenges
  FOR SELECT USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- create: only as the challenger, only before kickoff
DROP POLICY IF EXISTS "create challenge" ON challenges;
CREATE POLICY "create challenge" ON challenges
  FOR INSERT WITH CHECK (
    auth.uid() = challenger_id
    AND challenger_id <> opponent_id
    AND (SELECT kickoff_utc FROM matches WHERE id = match_id) > NOW()
  );

-- respond: only the opponent, only before kickoff (accept sets their pick)
DROP POLICY IF EXISTS "respond challenge" ON challenges;
CREATE POLICY "respond challenge" ON challenges
  FOR UPDATE USING (auth.uid() = opponent_id)
  WITH CHECK (
    auth.uid() = opponent_id
    AND (SELECT kickoff_utc FROM matches WHERE id = match_id) > NOW()
  );

-- cancel: challenger may delete a still-pending challenge
DROP POLICY IF EXISTS "cancel challenge" ON challenges;
CREATE POLICY "cancel challenge" ON challenges
  FOR DELETE USING (auth.uid() = challenger_id AND status = 'pending');

DROP TRIGGER IF EXISTS trg_challenges_updated ON challenges;
CREATE TRIGGER trg_challenges_updated
  BEFORE UPDATE ON challenges
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── notifications ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,            -- challenge_received | challenge_accepted | challenge_declined
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  match_id     TEXT,
  actor_id     UUID,                     -- who triggered it
  actor_name   TEXT,
  read         BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "see own notifications" ON notifications;
CREATE POLICY "see own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "update own notifications" ON notifications;
CREATE POLICY "update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- trigger: create notifications for the relevant user (runs as definer → may
-- write notifications addressed to the other participant).
CREATE OR REPLACE FUNCTION public.on_challenge_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor TEXT;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    SELECT display_name INTO actor FROM profiles WHERE user_id = NEW.challenger_id;
    INSERT INTO notifications (user_id, type, challenge_id, match_id, actor_id, actor_name)
    VALUES (NEW.opponent_id, 'challenge_received', NEW.id, NEW.match_id, NEW.challenger_id, COALESCE(actor, 'A player'));
  ELSIF (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    SELECT display_name INTO actor FROM profiles WHERE user_id = NEW.opponent_id;
    IF NEW.status = 'accepted' THEN
      INSERT INTO notifications (user_id, type, challenge_id, match_id, actor_id, actor_name)
      VALUES (NEW.challenger_id, 'challenge_accepted', NEW.id, NEW.match_id, NEW.opponent_id, COALESCE(actor, 'A player'));
    ELSIF NEW.status = 'declined' THEN
      INSERT INTO notifications (user_id, type, challenge_id, match_id, actor_id, actor_name)
      VALUES (NEW.challenger_id, 'challenge_declined', NEW.id, NEW.match_id, NEW.opponent_id, COALESCE(actor, 'A player'));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_challenge_notify ON challenges;
CREATE TRIGGER trg_challenge_notify
  AFTER INSERT OR UPDATE ON challenges
  FOR EACH ROW EXECUTE FUNCTION public.on_challenge_change();

-- ── my challenges (computed view via function) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_challenges()
RETURNS TABLE (
  id UUID, match_id TEXT, status TEXT,
  role TEXT,                 -- 'challenger' | 'opponent'
  other_id UUID, other_name TEXT, other_avatar TEXT,
  my_side TEXT, my_margin INTEGER, their_side TEXT, their_margin INTEGER,
  match_status TEXT, home_score INTEGER, away_score INTEGER, kickoff_utc TIMESTAMPTZ,
  outcome TEXT,              -- 'won' | 'lost' | 'tie' | 'pending'
  created_at TIMESTAMPTZ
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.id, c.match_id, c.status,
    CASE WHEN c.challenger_id = auth.uid() THEN 'challenger' ELSE 'opponent' END AS role,
    CASE WHEN c.challenger_id = auth.uid() THEN c.opponent_id ELSE c.challenger_id END AS other_id,
    COALESCE(po.display_name, 'Player') AS other_name,
    po.avatar_url AS other_avatar,
    CASE WHEN c.challenger_id = auth.uid() THEN c.challenger_side ELSE c.opponent_side END AS my_side,
    CASE WHEN c.challenger_id = auth.uid() THEN c.challenger_margin ELSE c.opponent_margin END AS my_margin,
    CASE WHEN c.challenger_id = auth.uid() THEN c.opponent_side ELSE c.challenger_side END AS their_side,
    CASE WHEN c.challenger_id = auth.uid() THEN c.opponent_margin ELSE c.challenger_margin END AS their_margin,
    m.status AS match_status, m.home_score, m.away_score, m.kickoff_utc,
    CASE
      WHEN c.status <> 'accepted' OR m.status <> 'finished' THEN 'pending'
      ELSE (
        WITH d AS (
          SELECT
            public.ch_dist(c.challenger_side, c.challenger_margin, m.home_score, m.away_score) AS dc,
            public.ch_dist(c.opponent_side, c.opponent_margin, m.home_score, m.away_score) AS dop
        )
        SELECT CASE
          WHEN d.dc = d.dop THEN 'tie'
          WHEN (c.challenger_id = auth.uid()) = (d.dc < d.dop) THEN 'won'
          ELSE 'lost'
        END FROM d
      )
    END AS outcome,
    c.created_at
  FROM challenges c
  JOIN matches m ON m.id = c.match_id
  LEFT JOIN profiles po ON po.user_id =
    (CASE WHEN c.challenger_id = auth.uid() THEN c.opponent_id ELSE c.challenger_id END)
  WHERE c.challenger_id = auth.uid() OR c.opponent_id = auth.uid()
  ORDER BY c.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_challenges() TO anon, authenticated;

-- ── leaderboard v3: prediction points + challenge points ───────────────────
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
    (COALESCE(pred.pred_points,0)+COALESCE(chal.chal_points,0))::INT AS points,
    COALESCE(pred.predicted,0)::INT AS predicted,
    COALESCE(pred.exact,0)::INT AS exact,
    COALESCE(pred.total,0)::INT AS total,
    COALESCE(chal.chal_points,0)::INT AS challenge_points
  FROM ids i
  LEFT JOIN pred ON pred.user_id=i.user_id
  LEFT JOIN chal ON chal.user_id=i.user_id
  LEFT JOIN profiles prof ON prof.user_id=i.user_id
  ORDER BY points DESC, exact DESC, total DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO anon, authenticated;

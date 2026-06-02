-- 014_security_hardening.sql — security review follow-ups for 011–013.
--
-- Applied as a NEW migration (not edits to 011–013) so it works whether or not
-- those migrations are already live on the remote project.
--
-- Fixes:
--   1. challenges: lock the opponent's UPDATE to pending rows only + freeze the
--      challenger's columns (was: opponent could rewrite the rival's pick / reopen
--      resolved challenges before kickoff — IDOR / score manipulation).
--   2. profiles: cap display_name length (UGC shown publicly + copied into other
--      users' notifications as actor_name).
--   3. Least privilege: revoke EXECUTE on the identity-scoped RPCs from `anon`.
--   4. ch_side / ch_dist: pin search_path.

-- ── 1) challenges: respond-only-when-pending + immutable challenger columns ──
DROP POLICY IF EXISTS "respond challenge" ON challenges;
CREATE POLICY "respond challenge" ON challenges
  FOR UPDATE
  USING (auth.uid() = opponent_id AND status = 'pending')
  WITH CHECK (
    auth.uid() = opponent_id
    AND status IN ('accepted', 'declined')
    AND (SELECT kickoff_utc FROM matches WHERE id = match_id) > NOW()
  );

-- RLS cannot restrict *which columns* an UPDATE touches, so guard the immutable
-- ones (and forbid illegal status transitions) with a BEFORE UPDATE trigger.
CREATE OR REPLACE FUNCTION public.challenges_guard_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The challenger's pick and the participants/match are set at creation and may
  -- never change. Only the opponent's response fields + status may move.
  IF NEW.match_id          IS DISTINCT FROM OLD.match_id
   OR NEW.challenger_id     IS DISTINCT FROM OLD.challenger_id
   OR NEW.opponent_id       IS DISTINCT FROM OLD.opponent_id
   OR NEW.challenger_side   IS DISTINCT FROM OLD.challenger_side
   OR NEW.challenger_margin IS DISTINCT FROM OLD.challenger_margin THEN
    RAISE EXCEPTION 'challenge: cannot modify immutable fields';
  END IF;

  -- Only pending → accepted/declined is allowed; resolved challenges are frozen.
  IF OLD.status <> 'pending' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'challenge: status is already resolved';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_challenges_guard ON challenges;
CREATE TRIGGER trg_challenges_guard
  BEFORE UPDATE ON challenges
  FOR EACH ROW EXECUTE FUNCTION public.challenges_guard_update();

-- ── 2) profiles: bound display_name length (UGC) ────────────────────────────
-- Truncate any existing over-long names so the constraint can be added safely.
UPDATE profiles SET display_name = LEFT(display_name, 40)
  WHERE display_name IS NOT NULL AND char_length(display_name) > 40;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_display_name_len;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_display_name_len
  CHECK (display_name IS NULL OR char_length(display_name) <= 40);

-- ── 3) Least privilege on identity-scoped RPCs ──────────────────────────────
-- These depend on auth.uid(); a true `anon` (no session) gets nothing useful, so
-- there's no reason to expose them. The app always runs with at least an
-- anonymous *session* (authenticated role), so this doesn't affect it.
-- (get_leaderboard stays granted to anon in case the ranking is shown to guests.)
REVOKE EXECUTE ON FUNCTION public.get_my_challenges() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_predictions(UUID) FROM anon;

-- ── 4) Pin search_path on the challenge helper functions ────────────────────
CREATE OR REPLACE FUNCTION public.ch_side(h INTEGER, a INTEGER)
RETURNS TEXT IMMUTABLE LANGUAGE sql
SET search_path = pg_catalog, public AS $$
  SELECT CASE WHEN h > a THEN 'home' WHEN a > h THEN 'away' ELSE 'draw' END;
$$;

CREATE OR REPLACE FUNCTION public.ch_dist(side TEXT, margin INTEGER, h INTEGER, a INTEGER)
RETURNS INTEGER IMMUTABLE LANGUAGE sql
SET search_path = pg_catalog, public AS $$
  SELECT CASE
    WHEN side = public.ch_side(h, a) THEN ABS(margin - ABS(h - a))
    ELSE 1000 + ABS(margin - ABS(h - a))
  END;
$$;

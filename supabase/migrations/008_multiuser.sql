-- 008_multiuser.sql — Phase 1: lock down shared data + per-user profiles.

-- 1) Scores are READ-ONLY for users. Only the live-sync cron (service role,
--    which bypasses RLS) may write. Remove the open authenticated UPDATE policy.
DROP POLICY IF EXISTS "authenticated update matches" ON matches;

-- 2) Public user profiles (for the leaderboard / social display).
CREATE TABLE IF NOT EXISTS profiles (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url   TEXT,
  country      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone may read profiles (needed for the leaderboard).
DROP POLICY IF EXISTS "public read profiles" ON profiles;
CREATE POLICY "public read profiles" ON profiles
  FOR SELECT USING (true);

-- A user may insert/update/delete ONLY their own profile.
DROP POLICY IF EXISTS "owner writes profile" ON profiles;
CREATE POLICY "owner writes profile" ON profiles
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- keep updated_at fresh
DROP TRIGGER IF EXISTS trg_profiles_updated ON profiles;
CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

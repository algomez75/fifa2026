-- 007_read_policies.sql — public read access for tournament data.
-- This project enables RLS on every table by default, so the read-only public
-- tables need an explicit permissive SELECT policy for the anon/authenticated
-- roles. (user_settings keeps its owner-only policy from migration 004.)

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read teams" ON teams;
CREATE POLICY "public read teams" ON teams FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read venues" ON venues;
CREATE POLICY "public read venues" ON venues FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read matches" ON matches;
CREATE POLICY "public read matches" ON matches FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read historical_editions" ON historical_editions;
CREATE POLICY "public read historical_editions" ON historical_editions FOR SELECT USING (true);

DROP POLICY IF EXISTS "public read historical_matches" ON historical_matches;
CREATE POLICY "public read historical_matches" ON historical_matches FOR SELECT USING (true);

-- Allow signed-in (incl. anonymous) users to record manual score edits.
DROP POLICY IF EXISTS "authenticated update matches" ON matches;
CREATE POLICY "authenticated update matches" ON matches
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 024_player_photos_bucket.sql — self-hosted player headshots.
-- Players' photos used to be hotlinked to media.api-sports.io. We now download
-- every photo (api-sports + Wikimedia Commons fallback) into our own public
-- bucket so the images are permanent and CDN-served. Files live at
--   player-photos/<player_id>.jpg
-- Written only by scripts/host-player-photos.mjs (service role, bypasses RLS).

INSERT INTO storage.buckets (id, name, public)
VALUES ('player-photos', 'player-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read player photos (public bucket, shown in lineups/squads).
DROP POLICY IF EXISTS "player photos public read" ON storage.objects;
CREATE POLICY "player photos public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'player-photos');

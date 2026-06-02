-- 009_avatars.sql — avatar storage bucket + RLS.
-- Avatars are stored at  avatars/<user_id>/avatar.jpg  (folder = owner uid).

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read avatars (public bucket, used in leaderboard/headers).
DROP POLICY IF EXISTS "avatar public read" ON storage.objects;
CREATE POLICY "avatar public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- A user may write only inside their own folder (first path segment = their uid).
DROP POLICY IF EXISTS "avatar owner insert" ON storage.objects;
CREATE POLICY "avatar owner insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatar owner update" ON storage.objects;
CREATE POLICY "avatar owner update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatar owner delete" ON storage.objects;
CREATE POLICY "avatar owner delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );

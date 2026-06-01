-- 004_user_settings.sql — per-user preferences (RLS-protected)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  favorite_team_ids    TEXT[] DEFAULT '{}',
  notify_favorites     BOOLEAN DEFAULT true,
  notify_all           BOOLEAN DEFAULT false,
  notify_minutes_before INTEGER DEFAULT 15,
  timezone             TEXT DEFAULT 'America/New_York',
  language             TEXT DEFAULT 'en',
  expo_push_token      TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users own settings" ON user_settings;
CREATE POLICY "users own settings" ON user_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- index for the notification dispatcher (find tokens fast)
CREATE INDEX IF NOT EXISTS idx_user_settings_push
  ON user_settings (expo_push_token)
  WHERE expo_push_token IS NOT NULL;

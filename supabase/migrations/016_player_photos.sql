-- 016_player_photos.sql — player headshot URLs (API-Football CDN) shown as
-- circular avatars in the squad list. Populated by
-- scripts/import-player-photos.mjs, which also backfills shirt numbers and
-- teams.api_football_id while it's at it.

ALTER TABLE players ADD COLUMN IF NOT EXISTS photo_url TEXT;

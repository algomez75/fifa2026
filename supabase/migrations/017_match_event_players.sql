-- 017_match_event_players.sql — link goal events to player rows so the app can
-- show the scorer's photo avatar (players.photo_url) on match cards.
-- sync-scores resolves player_id by normalized name at upsert time.

ALTER TABLE match_events
  ADD COLUMN IF NOT EXISTS player_id INTEGER REFERENCES players(id) ON DELETE SET NULL;

-- Backfill existing events by exact (case-insensitive) name within the team.
UPDATE match_events me
SET player_id = p.id
FROM players p
WHERE me.player_id IS NULL
  AND p.team_id = me.team_id
  AND lower(p.name) = lower(me.player_name);

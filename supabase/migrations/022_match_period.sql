-- 022_match_period.sql
-- Surface the live match PERIOD to clients so the UI can:
--   1) anchor a locally-ticking match clock on the server minute, and
--   2) show "Half Time" when football-data reports status = PAUSED.
--
-- `status` stays 'live' for both IN_PLAY and PAUSED (every existing filter
-- relies on that), so the half-time signal lives in this separate column.
--
-- Values written by sync-scores:
--   '1H' | '2H'  → in play (derived from the running minute)
--   'HT'         → half-time / break (football-data PAUSED)
--   'ET'         → extra time, 'PEN' → penalty shootout
--   NULL         → not live (scheduled / finished)

ALTER TABLE matches ADD COLUMN IF NOT EXISTS period TEXT;

-- Already-finished matches are not live → no period.
UPDATE matches SET period = NULL WHERE status = 'finished';

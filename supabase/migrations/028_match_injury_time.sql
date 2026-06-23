-- 028_match_injury_time.sql
-- Surface the REAL announced added minutes (football-data `injuryTime`) on the
-- live matches row so the on-device clock can CAP the displayed stoppage at the
-- real board number instead of inventing "90+7" when the 4th official only
-- raised "+4" — and so it freezes cleanly at the half boundary going into a
-- pause.
--
-- The value already arrives every ~5s in the cheap LIST call
-- (`/competitions/WC/matches`), but until now it only landed (stale) in
-- `match_details.injury_time` via the gated DETAIL fetch (migration 019). This
-- column lets sync-scores write it on every LIST tick.
--
-- Nullable on purpose: `injuryTime` is NULL before the board goes up and between
-- halves. The client treats NULL as "cap = boundary" (freeze at 45:00 / 90:00).
-- `matches` is already in the supabase_realtime publication (005) with full-row
-- replication + public-read RLS, so this streams to clients with no further
-- change. The set_updated_at trigger keeps `updated_at` accurate on these writes.

ALTER TABLE matches ADD COLUMN IF NOT EXISTS injury_time INTEGER;

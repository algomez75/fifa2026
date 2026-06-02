-- 014_push_notifications.sql — deliver in-app notification rows to the device.
--
-- Challenge events (received / accepted / declined) are written to the
-- `notifications` table by the trigger in 013. This flag lets the
-- notify-dispatcher edge function fan them out to the recipient's Expo push
-- token (so they arrive on-device even when the app is closed) exactly once.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS pushed BOOLEAN NOT NULL DEFAULT false;

-- Fast lookup of the small set still awaiting device delivery.
CREATE INDEX IF NOT EXISTS idx_notifications_unpushed
  ON notifications (created_at)
  WHERE pushed = false;

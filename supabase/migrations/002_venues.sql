-- 002_venues.sql — 16 host venues
CREATE TABLE IF NOT EXISTS venues (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  city     TEXT NOT NULL,
  country  TEXT NOT NULL,                  -- USA / Mexico / Canada
  capacity INTEGER,
  lat      DECIMAL(9,6),
  lng      DECIMAL(9,6),
  color    TEXT                            -- city brand color for gradient headers
);

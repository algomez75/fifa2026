/**
 * Bundled seed data — the app's offline source of truth until Supabase is wired.
 * Canonical JSON lives in /data/seed (also used by SQL seed + scripts/seed.ts).
 */
import teamsJson from '../../data/seed/teams.json';
import venuesJson from '../../data/seed/venues.json';
import scheduleJson from '../../data/seed/schedule.json';
import historicalJson from '../../data/seed/historical.json';

import type {
  HistoricalEdition,
  HistoricalMatch,
  Match,
  Team,
  Venue,
} from './database.types';

export interface SeedVenue extends Venue {
  color: string;
}

export const seedTeams = teamsJson as Team[];
export const seedVenues = venuesJson as SeedVenue[];
export const seedSchedule = scheduleJson as Match[];
export const seedHistory = historicalJson as {
  editions: HistoricalEdition[];
  matches: (HistoricalMatch & { id?: number })[];
};

// Lookup maps for O(1) joins in the UI.
export const teamsById: Record<string, Team> = Object.fromEntries(
  seedTeams.map((t) => [t.id, t]),
);
export const venuesById: Record<string, SeedVenue> = Object.fromEntries(
  seedVenues.map((v) => [v.id, v]),
);

export const groupLetters = Array.from(
  new Set(seedTeams.map((t) => t.group_letter).filter(Boolean) as string[]),
).sort();

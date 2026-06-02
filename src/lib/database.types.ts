/**
 * Database row types — mirror the Supabase schema (supabase/migrations).
 * Hand-written for now; regenerate later with:
 *   supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 */

export type MatchStatus = 'scheduled' | 'live' | 'finished';
export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final';
export type Confederation =
  | 'UEFA'
  | 'CONMEBOL'
  | 'CONCACAF'
  | 'CAF'
  | 'AFC'
  | 'OFC';

export interface Team {
  id: string;
  name: string;
  name_es: string | null;
  flag_emoji: string | null;
  iso2: string | null; // ISO-3166 alpha-2 for react-native-country-flag
  group_letter: string | null;
  host_country: boolean;
  api_football_id: number | null;
  confederation: Confederation | null;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  country: 'USA' | 'Mexico' | 'Canada';
  capacity: number | null;
  lat: number | null;
  lng: number | null;
}

export interface Match {
  id: string;
  stage: Stage;
  group_letter: string | null;
  match_number: number | null;
  home_team_id: string | null;
  away_team_id: string | null;
  /** Placeholder label shown when a knockout slot is undecided (e.g. "Winner Group A"). */
  home_placeholder: string | null;
  away_placeholder: string | null;
  home_score: number | null;
  away_score: number | null;
  home_score_penalties: number | null;
  away_score_penalties: number | null;
  status: MatchStatus;
  kickoff_utc: string;
  venue_id: string | null;
  api_football_fixture_id: number | null;
  minute: number | null;
  updated_at: string;
}

export interface Player {
  id: number;
  team_id: string;
  fd_player_id: number | null;
  name: string;
  position: 'Goalkeeper' | 'Defence' | 'Midfield' | 'Offence' | string | null;
  date_of_birth: string | null;
  nationality: string | null;
  shirt_number: number | null;
}

export interface UserSettings {
  user_id: string;
  favorite_team_ids: string[];
  notify_favorites: boolean;
  notify_all: boolean;
  notify_minutes_before: number;
  timezone: string;
  language: 'en' | 'es';
  expo_push_token: string | null;
  created_at: string;
}

export interface HistoricalEdition {
  year: number;
  host: string | null;
  champion: string | null;
  runner_up: string | null;
  third_place: string | null;
  total_goals: number | null;
  total_teams: number | null;
  final_score: string | null;
  top_scorer: string | null;
}

export interface HistoricalMatch {
  id: number;
  year: number;
  stage: string | null;
  home_team: string | null;
  away_team: string | null;
  home_score: number | null;
  away_score: number | null;
  venue: string | null;
  match_date: string | null;
}

/** Minimal typed shape passed to supabase-js generic. */
export interface Database {
  public: {
    Tables: {
      teams: { Row: Team; Insert: Team; Update: Partial<Team> };
      venues: { Row: Venue; Insert: Venue; Update: Partial<Venue> };
      matches: { Row: Match; Insert: Match; Update: Partial<Match> };
      user_settings: {
        Row: UserSettings;
        Insert: Partial<UserSettings> & { user_id: string };
        Update: Partial<UserSettings>;
      };
      historical_editions: {
        Row: HistoricalEdition;
        Insert: HistoricalEdition;
        Update: Partial<HistoricalEdition>;
      };
      historical_matches: {
        Row: HistoricalMatch;
        Insert: Omit<HistoricalMatch, 'id'>;
        Update: Partial<HistoricalMatch>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

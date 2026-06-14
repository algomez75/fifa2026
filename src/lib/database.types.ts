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

export type Team = {
  id: string;
  name: string;
  name_es: string | null;
  flag_emoji: string | null;
  iso2: string | null; // ISO-3166 alpha-2 for react-native-country-flag
  group_letter: string | null;
  host_country: boolean;
  api_football_id: number | null;
  confederation: Confederation | null;
  // football-data.org metadata (migration 010) — absent from bundled seed JSON.
  crest_url?: string | null;
  coach?: string | null;
  fd_team_id?: number | null;
}

export type Venue = {
  id: string;
  name: string;
  city: string;
  country: 'USA' | 'Mexico' | 'Canada';
  capacity: number | null;
  lat: number | null;
  lng: number | null;
}

export type Match = {
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
  /** Live period for the half-time label + ticking clock: '1H'|'2H'|'HT'|'ET'|'PEN'|null
   *  (set by sync-scores; 'HT' = football-data PAUSED). See migration 022. */
  period?: string | null;
  /** Full-time push already sent (server-side dedupe; app never writes it). */
  result_pushed?: boolean;
  updated_at: string;
}

/** Tournament golden-boot row, replaced wholesale by sync-scores. */
export type TopScorerRow = {
  rank: number;
  fd_player_id: number | null;
  player_id: number | null;
  player_name: string;
  team_id: string | null;
  goals: number;
  assists: number | null;
  penalties: number | null;
  played: number | null;
  updated_at?: string;
}

/** A single match event (goal or card), synced from football-data by the
 *  sync-scores edge function. Public-read; goals drive live celebrations. */
export type MatchEventRow = {
  id: string;
  match_id: string;
  seq: number;
  type: string;
  minute: number | null;
  team_id: string | null;
  /** Linked players.id when the scorer name resolved (drives the photo avatar). */
  player_id: number | null;
  player_name: string | null;
  score_home: number | null;
  score_away: number | null;
  pushed: boolean;
  created_at: string;
}

export type Player = {
  id: number;
  team_id: string;
  fd_player_id: number | null;
  name: string;
  position: 'Goalkeeper' | 'Defence' | 'Midfield' | 'Offence' | string | null;
  date_of_birth: string | null;
  nationality: string | null;
  shirt_number: number | null;
  /** Headshot from the API-Football CDN (migration 016); null → initials avatar. */
  photo_url?: string | null;
}

export type Profile = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  created_at?: string;
  updated_at?: string;
}

export type Prediction = {
  user_id: string;
  match_id: string;
  home_pred: number;
  away_pred: number;
  created_at?: string;
  updated_at?: string;
}

export type LeaderboardRow = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  points: number;
  predicted: number;
  exact: number;
  total: number;
  /** Points earned from head-to-head challenges (get_leaderboard, migration 013). */
  challenge_points?: number;
}

export type UserPredictionRow = {
  match_id: string;
  home_pred: number | null;
  away_pred: number | null;
  kickoff_utc: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  points: number;
  revealed: boolean;
}

export type ChallengeSide = 'home' | 'away' | 'draw';
export type ChallengeStatus = 'pending' | 'accepted' | 'declined';
export type ChallengeOutcome = 'won' | 'lost' | 'tie' | 'pending';

/** A head-to-head challenge row (table `challenges`, migration 013). */
export type Challenge = {
  id: string;
  match_id: string;
  challenger_id: string;
  opponent_id: string;
  challenger_side: ChallengeSide;
  challenger_margin: number;
  opponent_side: ChallengeSide | null;
  opponent_margin: number | null;
  status: ChallengeStatus;
  created_at?: string;
  updated_at?: string;
}

export type MyChallengeRow = {
  id: string;
  match_id: string;
  status: ChallengeStatus;
  role: 'challenger' | 'opponent';
  other_id: string;
  other_name: string;
  other_avatar: string | null;
  my_side: ChallengeSide | null;
  my_margin: number | null;
  their_side: ChallengeSide | null;
  their_margin: number | null;
  match_status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  kickoff_utc: string;
  outcome: ChallengeOutcome;
  created_at: string;
}

export type NotificationRow = {
  id: string;
  user_id: string;
  type: 'challenge_received' | 'challenge_accepted' | 'challenge_declined' | string;
  challenge_id: string | null;
  match_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  read: boolean;
  pushed?: boolean;
  created_at: string;
}

export type UserSettings = {
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

export type HistoricalEdition = {
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

export type HistoricalMatch = {
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
      teams: { Row: Team; Insert: Team; Update: Partial<Team>; Relationships: [] };
      venues: { Row: Venue; Insert: Venue; Update: Partial<Venue>; Relationships: [] };
      matches: { Row: Match; Insert: Match; Update: Partial<Match>; Relationships: [] };
      match_events: {
        Row: MatchEventRow;
        Insert: Partial<MatchEventRow> & { match_id: string; seq: number };
        Update: Partial<MatchEventRow>;
        Relationships: [];
      };
      top_scorers: {
        Row: TopScorerRow;
        Insert: TopScorerRow;
        Update: Partial<TopScorerRow>;
        Relationships: [];
      };
      players: {
        Row: Player;
        Insert: Omit<Player, 'id'> & { id?: number };
        Update: Partial<Player>;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { user_id: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      predictions: {
        Row: Prediction;
        Insert: Prediction;
        Update: Partial<Prediction>;
        Relationships: [];
      };
      challenges: {
        Row: Challenge;
        Insert: Pick<
          Challenge,
          'match_id' | 'challenger_id' | 'opponent_id' | 'challenger_side' | 'challenger_margin'
        > &
          Partial<Challenge>;
        Update: Partial<Challenge>;
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: Partial<NotificationRow> & { user_id: string; type: string };
        Update: Partial<NotificationRow>;
        Relationships: [];
      };
      user_settings: {
        Row: UserSettings;
        Insert: Partial<UserSettings> & { user_id: string };
        Update: Partial<UserSettings>;
        Relationships: [];
      };
      historical_editions: {
        Row: HistoricalEdition;
        Insert: HistoricalEdition;
        Update: Partial<HistoricalEdition>;
        Relationships: [];
      };
      historical_matches: {
        Row: HistoricalMatch;
        Insert: Omit<HistoricalMatch, 'id'>;
        Update: Partial<HistoricalMatch>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_leaderboard: {
        Args: Record<PropertyKey, never>;
        Returns: LeaderboardRow[];
      };
      get_my_challenges: {
        Args: Record<PropertyKey, never>;
        Returns: MyChallengeRow[];
      };
      get_user_predictions: {
        Args: { target: string };
        Returns: UserPredictionRow[];
      };
    };
    Enums: Record<string, never>;
  };
}

import { useQuery } from '@tanstack/react-query';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { anyMatchHot, useMatches, WC_COMPETITION_ID } from './useMatches';

/** One official group-standings row (synced from football-data by sync-scores). */
export interface OfficialStanding {
  group_letter: string;
  team_id: string;
  position: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  form: string | null;
}

async function fetchStandings(): Promise<OfficialStanding[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('standings')
    .select(
      'group_letter, team_id, position, played, won, draw, lost, goals_for, goals_against, goal_difference, points, form',
    )
    .eq('competition_id', WC_COMPETITION_ID)
    .order('group_letter', { ascending: true })
    .order('position', { ascending: true });
  if (error) throw error;
  return (data ?? []) as OfficialStanding[];
}

/**
 * Official group standings (correct FIFA tiebreaks + form). Polls every minute;
 * returns `[]` when Supabase isn't configured or the table is empty, so callers
 * fall back to the client-side `computeStandings`.
 */
export function useStandings() {
  const { data: matches } = useMatches();
  // Official standings only move while a GROUP match is being played (or just
  // finished). During the entire knockout phase — and between group matchdays —
  // they're static, so the 60s poll on Home/Schedule was a pure no-op. Fetch
  // once on mount, then poll only while a group match is hot.
  const groupHot = anyMatchHot((matches ?? []).filter((m) => m.stage === 'group'));
  return useQuery({
    queryKey: ['standings'],
    queryFn: fetchStandings,
    staleTime: 30_000,
    refetchInterval: groupHot ? 60_000 : false,
    enabled: isSupabaseConfigured,
  });
}

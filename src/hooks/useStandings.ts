import { useQuery } from '@tanstack/react-query';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

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
  return useQuery({
    queryKey: ['standings'],
    queryFn: fetchStandings,
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: isSupabaseConfigured,
  });
}

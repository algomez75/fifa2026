import { useQuery } from '@tanstack/react-query';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export interface TopScorer {
  rank: number;
  player_name: string;
  team_id: string | null;
  goals: number;
  assists: number | null;
  penalties: number | null;
  played: number | null;
  player_photo: string | null;
}

async function fetchTopScorers(): Promise<TopScorer[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('top_scorers')
    .select('rank, player_name, team_id, goals, assists, penalties, played, player:players(photo_url)')
    .order('rank', { ascending: true });
  if (error) throw error;
  return (
    (data ?? []) as unknown as (Omit<TopScorer, 'player_photo'> & {
      player: { photo_url: string | null } | null;
    })[]
  ).map(({ player, ...row }) => ({ ...row, player_photo: player?.photo_url ?? null }));
}

/** Tournament golden-boot table, refreshed server-side by sync-scores. */
export function useTopScorers() {
  return useQuery({
    queryKey: ['top-scorers'],
    queryFn: fetchTopScorers,
    staleTime: 60_000,
    enabled: isSupabaseConfigured,
  });
}

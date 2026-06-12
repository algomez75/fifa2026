import { useQuery } from '@tanstack/react-query';

import type { MatchEventRow } from '@/lib/database.types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const matchEventsKey = ['match-events'] as const;

/** Goal event enriched with the scorer's photo (when the player is linked). */
export type GoalEvent = MatchEventRow & { player_photo: string | null };

async function fetchMatchEvents(): Promise<GoalEvent[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('match_events')
    .select('*, player:players(photo_url)')
    .eq('type', 'goal')
    .order('seq', { ascending: true });
  if (error) throw error;
  return (
    (data ?? []) as unknown as (MatchEventRow & {
      player: { photo_url: string | null } | null;
    })[]
  ).map(({ player, ...row }) => ({ ...row, player_photo: player?.photo_url ?? null }));
}

/**
 * All goal events of the tournament in one shared query (a few hundred rows at
 * most). Realtime INSERTs are patched into this cache by `useMatchRealtime`,
 * and the foreground/polling refetches keep it honest. Cards select their own
 * match's slice via `useMatchGoals`.
 */
export function useMatchEvents() {
  return useQuery({
    queryKey: matchEventsKey,
    queryFn: fetchMatchEvents,
    staleTime: 30_000,
    enabled: isSupabaseConfigured,
  });
}

/** Goals of one match, home/away split, ready for rendering. */
export function useMatchGoals(matchId: string, homeTeamId: string | null) {
  const { data } = useMatchEvents();
  const goals = (data ?? []).filter((e) => e.match_id === matchId) as GoalEvent[];
  return {
    home: goals.filter((g) => g.team_id != null && g.team_id === homeTeamId),
    away: goals.filter((g) => g.team_id == null || g.team_id !== homeTeamId),
    all: goals,
  };
}

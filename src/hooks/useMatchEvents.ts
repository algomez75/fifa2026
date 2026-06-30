import { useQuery } from '@tanstack/react-query';

import type { MatchEventRow } from '@/lib/database.types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { anyMatchHot, useMatches } from './useMatches';

export const matchEventsKey = ['match-events'] as const;

/** Match event (goal/card) enriched with the player's photo when linked. */
export type GoalEvent = MatchEventRow & { player_photo: string | null };

async function fetchMatchEvents(): Promise<GoalEvent[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('match_events')
    .select('*, player:players(photo_url)')
    .order('seq', { ascending: true });
  if (error) throw error;
  return (
    (data ?? []) as unknown as (MatchEventRow & {
      player: { photo_url: string | null } | null;
    })[]
  ).map(({ player, ...row }) => ({ ...row, player_photo: player?.photo_url ?? null }));
}

/**
 * All match events of the tournament (goals + cards) in one shared query.
 * Realtime INSERTs are patched into this cache by `useMatchRealtime`, and the
 * foreground/polling refetches keep it honest. Cards/screens select their own
 * slice via `useMatchGoals` / `useMatchCards`.
 */
export function useMatchEvents() {
  // While a match is hot, poll as a fallback to the Realtime channel so goals
  // that the socket missed appear — and, crucially, so VAR-annulled goals that
  // sync-scores DELETEs disappear from the UI even if the DELETE event is lost.
  const { data: matches } = useMatches();
  const hot = anyMatchHot(matches);
  return useQuery({
    queryKey: matchEventsKey,
    queryFn: fetchMatchEvents,
    staleTime: hot ? 6_000 : 30_000,
    refetchInterval: hot ? 8_000 : false,
    enabled: isSupabaseConfigured,
  });
}

/** Goals of one match, home/away split, ready for rendering. */
export function useMatchGoals(matchId: string, homeTeamId: string | null) {
  const { data } = useMatchEvents();
  const goals = (data ?? []).filter((e) => e.match_id === matchId && e.type === 'goal');
  return {
    home: goals.filter((g) => g.team_id != null && g.team_id === homeTeamId),
    // Only attribute to a side when BOTH ids are known — a null team_id (or a
    // not-yet-resolved homeTeamId) must not dump every goal on the away side.
    away: goals.filter((g) => g.team_id != null && homeTeamId != null && g.team_id !== homeTeamId),
    all: goals,
  };
}

/** Cards of one match: red cards individually, yellows as per-side counts. */
export function useMatchCards(matchId: string, homeTeamId: string | null) {
  const { data } = useMatchEvents();
  const cards = (data ?? []).filter(
    (e) => e.match_id === matchId && (e.type === 'red' || e.type === 'yellow'),
  );
  // null when the side can't be determined (unknown team) → counted on neither.
  const side = (g: GoalEvent): 'home' | 'away' | null =>
    g.team_id == null || homeTeamId == null ? null : g.team_id === homeTeamId ? 'home' : 'away';
  return {
    reds: cards.filter((c) => c.type === 'red'),
    homeReds: cards.filter((c) => c.type === 'red' && side(c) === 'home'),
    awayReds: cards.filter((c) => c.type === 'red' && side(c) === 'away'),
    homeYellows: cards.filter((c) => c.type === 'yellow' && side(c) === 'home').length,
    awayYellows: cards.filter((c) => c.type === 'yellow' && side(c) === 'away').length,
    any: cards.length > 0,
  };
}

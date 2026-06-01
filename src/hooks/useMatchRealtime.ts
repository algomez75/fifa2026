import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type { Match } from '@/lib/database.types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { matchesKey } from './useMatches';

export interface GoalEvent {
  matchId: string;
  match: Match;
}

/**
 * Subscribes to live `matches` UPDATEs via Supabase Realtime and patches the
 * TanStack cache in place. Fires `onGoal` when a score increases so the screen
 * can trigger a goal animation. No-op until Supabase is configured.
 */
export function useMatchRealtime(onGoal?: (e: GoalEvent) => void) {
  const qc = useQueryClient();
  const onGoalRef = useRef(onGoal);
  onGoalRef.current = onGoal;

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('live-matches')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: 'status=eq.live',
        },
        (payload) => {
          const next = payload.new as Match;
          const prevList = qc.getQueryData<Match[]>(matchesKey) ?? [];
          const prev = prevList.find((m) => m.id === next.id);

          qc.setQueryData<Match[]>(matchesKey, (old) =>
            (old ?? []).map((m) => (m.id === next.id ? { ...m, ...next } : m)),
          );

          const scoreUp =
            prev &&
            ((next.home_score ?? 0) > (prev.home_score ?? 0) ||
              (next.away_score ?? 0) > (prev.away_score ?? 0));
          if (scoreUp) onGoalRef.current?.({ matchId: next.id, match: next });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

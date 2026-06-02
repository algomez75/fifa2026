import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type { Match } from '@/lib/database.types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { matchesKey } from './useMatches';

export interface MatchEvent {
  matchId: string;
  match: Match;
}

export interface MatchRealtimeHandlers {
  /** A score increased on a live match. */
  onGoal?: (e: MatchEvent) => void;
  /** A match just transitioned to `finished` (full-time result). */
  onResult?: (e: MatchEvent) => void;
}

/**
 * Subscribes to `matches` UPDATEs via Supabase Realtime and patches the
 * TanStack cache in place. Fires `onGoal` when a score increases and `onResult`
 * the moment a match becomes `finished`, so the app can trigger celebrations
 * from anywhere. No-op until Supabase is configured.
 */
export function useMatchRealtime({ onGoal, onResult }: MatchRealtimeHandlers = {}) {
  const qc = useQueryClient();
  const onGoalRef = useRef(onGoal);
  const onResultRef = useRef(onResult);
  onGoalRef.current = onGoal;
  onResultRef.current = onResult;

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('live-matches')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        (payload) => {
          const next = payload.new as Match;
          const prevList = qc.getQueryData<Match[]>(matchesKey) ?? [];
          const prev = prevList.find((m) => m.id === next.id);

          qc.setQueryData<Match[]>(matchesKey, (old) =>
            (old ?? []).map((m) => (m.id === next.id ? { ...m, ...next } : m)),
          );

          if (next.status === 'live') {
            const scoreUp =
              prev &&
              ((next.home_score ?? 0) > (prev.home_score ?? 0) ||
                (next.away_score ?? 0) > (prev.away_score ?? 0));
            if (scoreUp) onGoalRef.current?.({ matchId: next.id, match: next });
          } else if (next.status === 'finished' && (!prev || prev.status !== 'finished')) {
            onResultRef.current?.({ matchId: next.id, match: next });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

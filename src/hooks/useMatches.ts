import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Match, MatchStatus } from '@/lib/database.types';
import { seedSchedule } from '@/lib/seed';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const matchesKey = ['matches'] as const;

async function fetchMatches(): Promise<Match[]> {
  if (!isSupabaseConfigured) return seedSchedule;
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .order('kickoff_utc', { ascending: true });
  if (error) throw error;
  // Fall back to bundled schedule if the table hasn't been seeded yet.
  return data && data.length ? (data as Match[]) : seedSchedule;
}

export function useMatches() {
  return useQuery({
    queryKey: matchesKey,
    queryFn: fetchMatches,
    initialData: seedSchedule,
  });
}

export interface ScoreUpdate {
  id: string;
  home_score: number;
  away_score: number;
  status?: MatchStatus;
  minute?: number | null;
}

/**
 * Manual score entry. Optimistically updates the local cache; persists to
 * Supabase when configured. Works fully offline against seed data otherwise.
 */
export function useUpdateScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (update: ScoreUpdate) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('matches')
          .update({
            home_score: update.home_score,
            away_score: update.away_score,
            status: update.status ?? 'finished',
            minute: update.minute ?? null,
          })
          .eq('id', update.id);
        if (error) throw error;
      }
      return update;
    },
    onMutate: async (update) => {
      await qc.cancelQueries({ queryKey: matchesKey });
      const prev = qc.getQueryData<Match[]>(matchesKey);
      qc.setQueryData<Match[]>(matchesKey, (old) =>
        (old ?? []).map((m) =>
          m.id === update.id
            ? {
                ...m,
                home_score: update.home_score,
                away_score: update.away_score,
                status: update.status ?? 'finished',
                minute: update.minute ?? m.minute,
                updated_at: new Date().toISOString(),
              }
            : m,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(matchesKey, ctx.prev);
    },
  });
}

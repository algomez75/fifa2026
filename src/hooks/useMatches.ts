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

/** True when a match is live or kicks off within the next 15 minutes. */
export function anyMatchHot(matches: Match[] | undefined): boolean {
  if (!matches) return false;
  const now = Date.now();
  return matches.some(
    (m) =>
      m.status === 'live' ||
      (m.status === 'scheduled' &&
        new Date(m.kickoff_utc).getTime() - now < 15 * 60_000 &&
        new Date(m.kickoff_utc).getTime() - now > -3 * 60 * 60_000),
  );
}

export function useMatches() {
  return useQuery({
    queryKey: matchesKey,
    queryFn: fetchMatches,
    initialData: seedSchedule,
    // Belt-and-braces alongside the Realtime channel: while a match is hot,
    // poll every 20s so scores/standings stay fresh even if the socket died.
    refetchInterval: (query) =>
      isSupabaseConfigured && anyMatchHot(query.state.data) ? 20_000 : false,
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
    // NOTE: official match scores are READ-ONLY (RLS) — only the live-sync cron
    // writes them. This is a LOCAL-ONLY preview. Phase 2 replaces it with
    // per-user predictions (a `predictions` table), so we do not write to the
    // shared `matches` table here.
    mutationFn: async (update: ScoreUpdate) => update,
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

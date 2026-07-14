import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Match, MatchStatus } from '@/lib/database.types';
import { seedSchedule } from '@/lib/seed';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const matchesKey = ['matches'] as const;

/** This app is World-Cup-only: the backend now also hosts club-league rows
 *  (migration 027+), so every read must stay scoped to the WC competition. */
export const WC_COMPETITION_ID = 'world-cup-2026';

async function fetchMatches(): Promise<Match[]> {
  if (!isSupabaseConfigured) return seedSchedule;
  let { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('competition_id', WC_COMPETITION_ID)
    .order('kickoff_utc', { ascending: true });
  if (error?.code === '42703') {
    // Backend predates migration 027 (`competition_id` column missing).
    // Every row there is a WC match, so retry unfiltered instead of dropping
    // to the stale seed.
    ({ data, error } = await supabase
      .from('matches')
      .select('*')
      .order('kickoff_utc', { ascending: true }));
  }
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
    // The bundled seed renders instantly but must never MASK fresh data: mark
    // it born-stale so a cold start fetches the real matches immediately
    // (otherwise initialData counts as fresh for staleTime = 30s of old info).
    initialDataUpdatedAt: 0,
    // Belt-and-braces alongside the Realtime channel: while a match is hot,
    // poll every 10s so scores/clock stay fresh even if the socket died (the
    // server now syncs every ~5s).
    refetchInterval: (query) =>
      isSupabaseConfigured && anyMatchHot(query.state.data) ? 10_000 : false,
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

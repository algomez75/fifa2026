import { useQuery } from '@tanstack/react-query';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export interface LineupPlayer {
  name: string | null;
  position: string | null;
  shirtNumber: number | null;
  fd_id: number | null;
  player_id: number | null;
  /** Team captain, when the feed flags it. */
  captain?: boolean | null;
  /** Joined client-side from the players cache when available. */
  photo?: string | null;
}

export interface MatchDetail {
  match_id: string;
  home_formation: string | null;
  away_formation: string | null;
  home_lineup: LineupPlayer[] | null;
  away_lineup: LineupPlayer[] | null;
  home_bench: LineupPlayer[] | null;
  away_bench: LineupPlayer[] | null;
  home_stats: Record<string, number | string> | null;
  away_stats: Record<string, number | string> | null;
  substitutions:
    | { minute: number | null; team_id: string | null; out_name: string | null; in_name: string | null }[]
    | null;
  referee: string | null;
  referees:
    | { name: string | null; type: string | null; nationality: string | null }[]
    | null;
  attendance: number | null;
  injury_time: number | null;
}

async function fetchDetail(matchId: string): Promise<MatchDetail | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('match_details')
    .select('*')
    .eq('match_id', matchId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const detail = data as unknown as MatchDetail;

  // Enrich lineups/bench with player photos in one query.
  const ids = [
    ...(detail.home_lineup ?? []),
    ...(detail.away_lineup ?? []),
    ...(detail.home_bench ?? []),
    ...(detail.away_bench ?? []),
  ]
    .map((p) => p.player_id)
    .filter((id): id is number => id != null);
  if (ids.length) {
    const { data: photos } = await supabase
      .from('players')
      .select('id, photo_url')
      .in('id', ids);
    const photoById = new Map((photos ?? []).map((p) => [p.id, p.photo_url]));
    const enrich = (list: LineupPlayer[] | null) =>
      list?.map((p) => ({
        ...p,
        photo: p.player_id != null ? (photoById.get(p.player_id) ?? null) : null,
      })) ?? null;
    detail.home_lineup = enrich(detail.home_lineup);
    detail.away_lineup = enrich(detail.away_lineup);
    detail.home_bench = enrich(detail.home_bench);
    detail.away_bench = enrich(detail.away_bench);
  }
  return detail;
}

/** Rich match detail (lineups, formations, stats). Polls while fresh data may
 *  still be arriving: fast (~15s) during a live match so stats feel real-time,
 *  slower (~60s) before kickoff (lineups land ~1h out), and not at all once the
 *  match is finished (its stats are final — backfilled by sync-scores). */
export function useMatchDetail(
  matchId: string | undefined,
  opts: { live?: boolean; finished?: boolean } = {},
) {
  return useQuery({
    queryKey: ['match-detail', matchId],
    queryFn: () => fetchDetail(matchId!),
    enabled: !!matchId && isSupabaseConfigured,
    staleTime: opts.live ? 8_000 : 45_000,
    refetchInterval: opts.finished ? false : opts.live ? 15_000 : 60_000,
  });
}

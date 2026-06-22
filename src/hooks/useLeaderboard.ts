import { useQuery } from '@tanstack/react-query';

import type { LeaderboardRow } from '@/lib/database.types';
import { queryClient } from '@/lib/queryClient';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const leaderboardKey = ['leaderboard'] as const;

async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('get_leaderboard');
  if (error) throw error;
  return (data ?? []) as LeaderboardRow[];
}

/**
 * Warm the ranking cache at app startup (after auth) so the tab opens instantly
 * on first visit — no cold network round-trip. Errors are swallowed internally
 * by prefetchQuery, so it never affects startup.
 */
export function prefetchLeaderboard() {
  return queryClient.prefetchQuery({
    queryKey: leaderboardKey,
    queryFn: fetchLeaderboard,
    staleTime: 1000 * 10,
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: leaderboardKey,
    queryFn: fetchLeaderboard,
    staleTime: 1000 * 10,
    // Live-ish ranking: poll while the screen is mounted (pauses in background).
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    // Keep the cached ranking in memory across the session so returning to the
    // tab shows it instantly (no loading flash); polling keeps it fresh.
    gcTime: 1000 * 60 * 30,
    placeholderData: (prev) => prev,
  });
}

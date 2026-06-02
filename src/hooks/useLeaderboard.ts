import { useQuery } from '@tanstack/react-query';

import type { LeaderboardRow } from '@/lib/database.types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('get_leaderboard');
  if (error) throw error;
  return (data ?? []) as LeaderboardRow[];
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: fetchLeaderboard,
    staleTime: 1000 * 10,
    // Live-ish ranking: poll while the screen is mounted (pauses in background).
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });
}

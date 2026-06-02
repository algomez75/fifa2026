import { useQuery } from '@tanstack/react-query';

import type { UserPredictionRow } from '@/lib/database.types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

async function fetchUserPredictions(userId: string): Promise<UserPredictionRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('get_user_predictions', { target: userId });
  if (error) throw error;
  return (data ?? []) as UserPredictionRow[];
}

/** A user's predictions (others' upcoming picks are hidden until kickoff). */
export function useUserPredictions(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-predictions', userId],
    queryFn: () => fetchUserPredictions(userId!),
    enabled: !!userId,
    staleTime: 1000 * 20,
  });
}

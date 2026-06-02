import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Prediction } from '@/lib/database.types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const predictionsKey = ['predictions'] as const;

async function fetchPredictions(): Promise<Record<string, Prediction>> {
  if (!isSupabaseConfigured) return {};
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return {};
  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', userData.user.id);
  if (error) throw error;
  const map: Record<string, Prediction> = {};
  for (const p of (data ?? []) as Prediction[]) map[p.match_id] = p;
  return map;
}

/** All of the current user's predictions, keyed by match id. */
export function usePredictions() {
  return useQuery({
    queryKey: predictionsKey,
    queryFn: fetchPredictions,
    staleTime: 1000 * 30,
  });
}

export interface SetPredictionInput {
  matchId: string;
  homePred: number;
  awayPred: number;
}

/** Create/update the current user's prediction for a match (before kickoff). */
export function useSetPrediction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ matchId, homePred, awayPred }: SetPredictionInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('No session');
      const { error } = await supabase.from('predictions').upsert({
        user_id: userId,
        match_id: matchId,
        home_pred: homePred,
        away_pred: awayPred,
      });
      if (error) throw error;
      return { matchId, homePred, awayPred, userId };
    },
    onSuccess: ({ matchId, homePred, awayPred, userId }) => {
      qc.setQueryData<Record<string, Prediction>>(predictionsKey, (old) => ({
        ...(old ?? {}),
        [matchId]: {
          user_id: userId,
          match_id: matchId,
          home_pred: homePred,
          away_pred: awayPred,
        },
      }));
      // refresh the ranking (predictions-made count) + this user's detail list
      qc.invalidateQueries({ queryKey: ['leaderboard'] });
      qc.invalidateQueries({ queryKey: ['user-predictions', userId] });
    },
  });
}

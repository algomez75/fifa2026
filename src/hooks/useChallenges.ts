import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ChallengeSide, MyChallengeRow } from '@/lib/database.types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const challengesKey = ['challenges'] as const;

async function fetchChallenges(): Promise<MyChallengeRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('get_my_challenges');
  if (error) throw error;
  return (data ?? []) as MyChallengeRow[];
}

export function useChallenges() {
  return useQuery({
    queryKey: challengesKey,
    queryFn: fetchChallenges,
    staleTime: 1000 * 15,
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
  });
}

export interface CreateChallengeInput {
  matchId: string;
  opponentId: string;
  side: ChallengeSide;
  margin: number;
}

export function useCreateChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ matchId, opponentId, side, margin }: CreateChallengeInput) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('No session');
      const { error } = await supabase.from('challenges').insert({
        match_id: matchId,
        challenger_id: u.user.id,
        opponent_id: opponentId,
        challenger_side: side,
        challenger_margin: margin,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: challengesKey }),
  });
}

export interface RespondChallengeInput {
  id: string;
  accept: boolean;
  side?: ChallengeSide;
  margin?: number;
}

export function useRespondChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, accept, side, margin }: RespondChallengeInput) => {
      const patch = accept
        ? { status: 'accepted', opponent_side: side, opponent_margin: margin }
        : { status: 'declined' };
      const { error } = await supabase.from('challenges').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: challengesKey });
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

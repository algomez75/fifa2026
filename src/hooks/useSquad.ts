import { useQuery } from '@tanstack/react-query';

import type { Player } from '@/lib/database.types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const POSITION_ORDER = ['Goalkeeper', 'Defence', 'Midfield', 'Offence'];

export interface PositionGroup {
  position: string;
  players: Player[];
}

export interface SquadData {
  coach: string | null;
  groups: PositionGroup[];
  count: number;
}

async function fetchSquad(teamId: string): Promise<SquadData> {
  if (!isSupabaseConfigured) return { coach: null, groups: [], count: 0 };

  const [playersRes, teamRes] = await Promise.all([
    supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
      .order('name', { ascending: true }),
    supabase.from('teams').select('coach').eq('id', teamId).maybeSingle(),
  ]);

  const players = (playersRes.data ?? []) as Player[];
  const byPos = new Map<string, Player[]>();
  for (const p of players) {
    const pos = p.position ?? 'Other';
    (byPos.get(pos) ?? byPos.set(pos, []).get(pos)!).push(p);
  }

  const groups: PositionGroup[] = [];
  for (const pos of POSITION_ORDER) {
    if (byPos.has(pos)) groups.push({ position: pos, players: byPos.get(pos)! });
  }
  // any unrecognized positions appended last
  for (const [pos, list] of byPos) {
    if (!POSITION_ORDER.includes(pos)) groups.push({ position: pos, players: list });
  }

  return {
    coach: (teamRes.data as { coach: string | null } | null)?.coach ?? null,
    groups,
    count: players.length,
  };
}

export function useSquad(teamId: string | undefined) {
  return useQuery({
    queryKey: ['squad', teamId],
    queryFn: () => fetchSquad(teamId!),
    enabled: !!teamId,
    staleTime: 1000 * 60 * 60, // squads rarely change
  });
}

/** Age in whole years from an ISO date-of-birth. */
export function ageFromDob(dob: string | null, now = Date.now()): number | null {
  if (!dob) return null;
  const birth = new Date(dob).getTime();
  if (isNaN(birth)) return null;
  return Math.floor((now - birth) / (365.25 * 24 * 3600 * 1000));
}

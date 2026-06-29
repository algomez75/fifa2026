import { useCallback, useMemo } from 'react';

import type { Match } from '@/lib/database.types';
import { resolveBracket } from '@/lib/qualification';

import { useBracketQualifiers } from './useBracketQualifiers';
import { useMatches } from './useMatches';

export interface ResolvedDisplayMatch {
  /** The match with undecided knockout sides filled by their real-time qualified
   *  team (display-only — `id`, scores, status, kickoff are untouched). */
  match: Match;
  home: { qualified: boolean; locked: boolean };
  away: { qualified: boolean; locked: boolean };
}

const TBD = { qualified: false, locked: false };

/**
 * Returns a `resolve(match)` that fills undecided knockout slots with their
 * real-time team in every round — a securely-qualified group team for R32, and
 * the winner/loser of a finished feeder for R16→Final (Apple-Sports progression,
 * resolved to a fixed point so it propagates through the rounds). Use anywhere a
 * match is shown so a knockout fixture renders real flags + names instead of
 * "Winner A". Predictions/challenges still key off the unchanged `match.id`.
 */
export function useResolveMatch() {
  const { data: matches } = useMatches();
  const qualifiers = useBracketQualifiers(matches ?? []);
  // One fixed-point resolve for the whole bracket, shared across every resolve().
  const bracket = useMemo(
    () => resolveBracket(matches ?? [], qualifiers),
    [matches, qualifiers],
  );
  return useCallback(
    (m: Match): ResolvedDisplayMatch => {
      const r = bracket.get(m.id); // only knockout matches are in the map
      if (!r) return { match: m, home: TBD, away: TBD };
      const match =
        r.home.teamId === m.home_team_id && r.away.teamId === m.away_team_id
          ? m
          : { ...m, home_team_id: r.home.teamId, away_team_id: r.away.teamId };
      return {
        match,
        home: { qualified: r.home.isQualified, locked: r.home.isLocked },
        away: { qualified: r.away.isQualified, locked: r.away.isLocked },
      };
    },
    [bracket],
  );
}

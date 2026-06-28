import { useCallback } from 'react';

import type { Match } from '@/lib/database.types';
import { resolveMatchTeams } from '@/lib/qualification';

import { useBracketQualifiers } from './useBracketQualifiers';
import { useMatches } from './useMatches';

export interface ResolvedDisplayMatch {
  /** The match with undecided knockout sides filled by their real-time qualified
   *  team (display-only — `id`, scores, status, kickoff are untouched). */
  match: Match;
  home: { qualified: boolean; locked: boolean };
  away: { qualified: boolean; locked: boolean };
}

/**
 * Returns a `resolve(match)` that fills undecided R32 knockout slots with their
 * securely-qualified teams in real time (the same source as the Bracket /
 * Schedule), plus the locked/provisional markers. Use anywhere a match is shown
 * so a knockout fixture always renders real flags + names instead of
 * "Winner A". Predictions/challenges still key off the unchanged `match.id`.
 */
export function useResolveMatch() {
  const { data: matches } = useMatches();
  const qualifiers = useBracketQualifiers(matches ?? []);
  return useCallback(
    (m: Match): ResolvedDisplayMatch => {
      const r = resolveMatchTeams(m, qualifiers);
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
    [qualifiers],
  );
}

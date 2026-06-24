import { useMemo } from 'react';

import type { Match } from '@/lib/database.types';
import { resolveGroupSlots } from '@/lib/qualification';
import { groupLetters, seedTeams } from '@/lib/seed';
import { computeStandings, type StandingRow } from '@/lib/standings';

import { useStandings } from './useStandings';

/**
 * Live map of knockout placeholder → securely-qualified `teamId`:
 *   `"Winner A"` / `"Runner-up B"` → the team mathematically through to that slot.
 *
 * Recomputes whenever results change (matches / official standings), so a team
 * snaps into the bracket the moment it clinches its group position — like Apple
 * Sports. Best-third (`"3rd …"`) and later-round (`"Winner R32-1"`) placeholders
 * are never in the map; they stay TBD until the server decides them.
 *
 * Uses the official football-data standings (correct FIFA tiebreaks) when
 * available — the same source the Groups table shows — falling back to the
 * client-side computation so it still works offline / before any sync.
 */
export function useBracketQualifiers(matches: Match[]): Map<string, string> {
  const { data: official } = useStandings();

  return useMemo(() => {
    const map = new Map<string, string>();

    // Team ids per group from the bundled seed (the canonical group makeup).
    const teamsByGroup: Record<string, string[]> = {};
    for (const team of seedTeams) {
      if (team.group_letter) (teamsByGroup[team.group_letter] ??= []).push(team.id);
    }

    for (const letter of groupLetters) {
      const teamIds = teamsByGroup[letter] ?? [];
      const groupMatches = matches.filter(
        (m) => m.stage === 'group' && m.group_letter === letter,
      );
      if (groupMatches.length === 0) continue;

      // Prefer official rows (already position-ordered, correct tiebreaks).
      const officialRows = (official ?? [])
        .filter((s) => s.group_letter === letter)
        .sort((a, b) => a.position - b.position)
        .map<StandingRow>((s) => ({
          teamId: s.team_id,
          played: s.played,
          won: s.won,
          drawn: s.draw,
          lost: s.lost,
          goalsFor: s.goals_for,
          goalsAgainst: s.goals_against,
          goalDiff: s.goal_difference,
          points: s.points,
        }));
      const rows = officialRows.length ? officialRows : computeStandings(teamIds, groupMatches);
      const finished = groupMatches.every((m) => m.status === 'finished');

      const { first, second } = resolveGroupSlots(rows, finished);
      if (first) map.set(`Winner ${letter}`, first);
      if (second) map.set(`Runner-up ${letter}`, second);
    }

    return map;
  }, [matches, official]);
}

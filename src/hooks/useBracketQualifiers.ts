import { useMemo } from 'react';

import type { Match } from '@/lib/database.types';
import { resolveGroupQualifiers } from '@/lib/qualification';
import { groupLetters, seedTeams } from '@/lib/seed';
import { reconcileStandings, type StandingRow } from '@/lib/standings';

import { useStandings } from './useStandings';

/** A bracket slot filled by the client from group standings. */
export interface BracketSlot {
  teamId: string;
  /** Position (1st/2nd) is mathematically fixed; else qualified but seed is
   *  provisional (placed by current order, may still swap live). */
  locked: boolean;
}

/**
 * Live map of knockout placeholder → securely-qualified slot:
 *   `"Winner A"` / `"Runner-up B"` → the team mathematically through to that slot.
 *
 * Recomputes whenever results change (matches / official standings), so a team
 * snaps into the bracket the moment it clinches advancement — like Apple Sports.
 * A team is placed by its CURRENT group position; `locked` says whether that
 * exact seed is fixed yet. Best-third (`"3rd …"`) and later-round
 * (`"Winner R32-1"`) placeholders are never in the map; they stay TBD until the
 * server decides them.
 *
 * Uses the official football-data standings (correct FIFA tiebreaks) when
 * available — the same source the Groups table shows — falling back to the
 * client-side computation so it still works offline / before any sync.
 */
export function useBracketQualifiers(matches: Match[]): Map<string, BracketSlot> {
  const { data: official } = useStandings();

  return useMemo(() => {
    const map = new Map<string, BracketSlot>();

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
      // Trust official rows only when consistent with the real results; a stale
      // upstream standings snapshot falls back to the match-derived table.
      const rows = reconcileStandings(officialRows, teamIds, groupMatches);

      const { byTeam } = resolveGroupQualifiers(rows, groupMatches);
      // At most two teams can be `advances`; place them by current order so the
      // bracket's 1st/2nd matches the Groups table.
      const advancers = rows.filter((r) => byTeam.get(r.teamId)?.advances);
      const first = advancers[0];
      const second = advancers[1];
      if (first)
        map.set(`Winner ${letter}`, {
          teamId: first.teamId,
          locked: !!byTeam.get(first.teamId)?.lockedFirst,
        });
      if (second)
        map.set(`Runner-up ${letter}`, {
          teamId: second.teamId,
          locked: !!byTeam.get(second.teamId)?.lockedSecond,
        });
    }

    return map;
  }, [matches, official]);
}

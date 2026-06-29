import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TeamFlag } from '@/components/TeamFlag';
import type { Match } from '@/lib/database.types';
import { teamAbbr, teamName } from '@/lib/format';
import { groupLetters, seedTeams, teamsById } from '@/lib/seed';
import { reconcileStandings, type StandingRow } from '@/lib/standings';
import { palette, radius } from '@/lib/theme';
import { useStandings } from '@/hooks/useStandings';
import { useTranslation } from '@/store/useAppStore';

/** Column 0 of the bracket: the 12 group standings, compacted to rank · flag ·
 *  name · points so they fit the half-screen column width (Apple-Sports style).
 *  Top-2 (who advance to the R32) carry the gold marker. */
export function BracketGroupsColumn({ matches, width }: { matches: Match[]; width: number }) {
  const { t, language } = useTranslation();
  const { data: official } = useStandings();
  // On narrow (SE-class) columns the full name has no room — use the 3-letter
  // code (USA/NED/RSA) instead of truncating to an ambiguous "Sou…".
  const compactNames = width < 135;

  const teamsByGroup = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const team of seedTeams) {
      if (team.group_letter) (map[team.group_letter] ??= []).push(team.id);
    }
    return map;
  }, []);

  return (
    <View style={{ width, gap: 10 }}>
      {groupLetters.map((letter) => {
        const teamIds = teamsByGroup[letter] ?? [];
        const groupMatches = matches.filter(
          (m) => m.stage === 'group' && m.group_letter === letter,
        );
        const officialRows = (official ?? [])
          .filter((s) => s.group_letter === letter)
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
        const rows = reconcileStandings(officialRows, teamIds, groupMatches);
        return (
          <View key={letter} style={styles.card}>
            <Text style={styles.head}>
              {t.groups.group} {letter}
            </Text>
            {rows.map((row, idx) => {
              const team = teamsById[row.teamId];
              const adv = idx < 2;
              return (
                <View key={row.teamId} style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: adv ? palette.gold : 'transparent' }]} />
                  <Text style={styles.pos}>{idx + 1}</Text>
                  <TeamFlag team={team} size={18} showName={false} />
                  <Text style={styles.name} numberOfLines={1}>
                    {compactNames ? teamAbbr(team) : teamName(team, language)}
                  </Text>
                  <Text style={[styles.pts, adv && styles.ptsAdv]}>{row.points}</Text>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  head: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: palette.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  dot: { width: 4, height: 14, borderRadius: 2 },
  pos: { color: palette.textSecondary, fontSize: 11, fontWeight: '700', width: 12 },
  name: { color: palette.text, fontSize: 13, fontWeight: '600', flex: 1, flexShrink: 1 },
  pts: { color: palette.textSecondary, fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  ptsAdv: { color: palette.gold },
});

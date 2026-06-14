import { StyleSheet, Text, View } from 'react-native';

import type { Match } from '@/lib/database.types';
import { teamName } from '@/lib/format';
import { computeStandings, type StandingRow } from '@/lib/standings';
import { useStandings } from '@/hooks/useStandings';
import { palette, radius } from '@/lib/theme';
import { teamsById } from '@/lib/seed';
import { useTranslation } from '@/store/useAppStore';
import { TeamFlag } from './TeamFlag';

interface Props {
  groupLetter: string;
  teamIds: string[];
  matches: Match[];
}

/** Standings table: P W D L GF GA GD Pts. Top 2 marked as qualifying. Uses the
 *  official football-data standings (correct FIFA tiebreaks) when available,
 *  else falls back to the client-side computation. */
export function GroupTable({ groupLetter, teamIds, matches }: Props) {
  const { t, language } = useTranslation();
  const { data: official } = useStandings();
  const c = t.groups.columns;

  // Official rows for this group (already ordered by position), mapped to the
  // shared shape; fall back to the client calc when none have synced yet.
  const officialRows = (official ?? [])
    .filter((s) => s.group_letter === groupLetter)
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
  const rows = officialRows.length ? officialRows : computeStandings(teamIds, matches);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.hTeam]}>{`${t.groups.group} ${groupLetter}`}</Text>
        <View style={styles.stats}>
          {[c.p, c.w, c.d, c.l, c.gf, c.ga, c.gd].map((h, i) => (
            <Text key={i} style={styles.hStat}>
              {h}
            </Text>
          ))}
          <Text style={[styles.hStat, styles.hPts]}>{c.pts}</Text>
        </View>
      </View>

      {rows.map((row, idx) => {
        const team = teamsById[row.teamId];
        const qualifying = idx < 2;
        return (
          <View
            key={row.teamId}
            style={[styles.row, idx === rows.length - 1 && styles.rowLast]}>
            <View style={styles.posCol}>
              <View
                style={[
                  styles.posDot,
                  { backgroundColor: qualifying ? palette.gold : 'transparent' },
                ]}
              />
              <Text style={styles.pos}>{idx + 1}</Text>
            </View>
            <View style={styles.teamCol}>
              <TeamFlag
                team={team}
                size={20}
                showName={false}
              />
              <Text style={styles.teamName} numberOfLines={1}>
                {teamName(team, language)}
              </Text>
            </View>
            <View style={styles.stats}>
              <Text style={styles.stat}>{row.played}</Text>
              <Text style={styles.stat}>{row.won}</Text>
              <Text style={styles.stat}>{row.drawn}</Text>
              <Text style={styles.stat}>{row.lost}</Text>
              <Text style={styles.stat}>{row.goalsFor}</Text>
              <Text style={styles.stat}>{row.goalsAgainst}</Text>
              <Text style={styles.stat}>
                {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
              </Text>
              <Text style={[styles.stat, styles.pts]}>{row.points}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const STAT_W = 22;

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: palette.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: palette.surface,
  },
  hTeam: {
    flex: 1,
    color: palette.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  stats: { flexDirection: 'row', alignItems: 'center' },
  hStat: {
    width: STAT_W,
    textAlign: 'center',
    color: palette.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  hPts: { color: palette.gold, width: STAT_W + 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  rowLast: {},
  posCol: { flexDirection: 'row', alignItems: 'center', width: 30, gap: 4 },
  posDot: { width: 4, height: 16, borderRadius: 2 },
  pos: { color: palette.textSecondary, fontSize: 12, fontWeight: '700' },
  teamCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 6,
  },
  teamName: { color: palette.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  stat: {
    width: STAT_W,
    textAlign: 'center',
    color: palette.text,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  pts: { width: STAT_W + 4, color: palette.gold, fontWeight: '900' },
});

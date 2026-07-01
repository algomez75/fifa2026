import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Match } from '@/lib/database.types';
import { formatKickoffTime, matchDayLabel, teamName } from '@/lib/format';
import { teamsById } from '@/lib/seed';
import { palette, stageMeta } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';
import { LiveBadge } from './LiveBadge';
import { TeamFlag } from './TeamFlag';

interface Props {
  match: Match;
  onPress?: (m: Match) => void;
}

/**
 * Apple-Sports-style compact result row: a centered stage line on top, then the
 * two teams with their flags + big scores on the outside and the status ("FT" /
 * live minute / kickoff time) in the middle, team names beneath each flag. Used
 * in the match detail "previous matches" list; the winner's score is emphasised.
 */
export function MatchResultRow({ match, onPress }: Props) {
  const { t, language } = useTranslation();
  const home = match.home_team_id ? teamsById[match.home_team_id] : undefined;
  const away = match.away_team_id ? teamsById[match.away_team_id] : undefined;

  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const decided = isLive || isFinished;
  const h = match.home_score;
  const a = match.away_score;

  const homeWin = isFinished && h != null && a != null && h > a;
  const awayWin = isFinished && h != null && a != null && a > h;

  const stage = stageMeta[match.stage];
  const stageLabel =
    match.stage === 'group' && match.group_letter
      ? `${t.groups.group} ${match.group_letter}`
      : (language === 'es' ? stage?.labelEs : stage?.label) ?? '';

  const scoreText = (s: number | null | undefined) => (s == null ? '–' : String(s));

  return (
    <Pressable
      onPress={() => onPress?.(match)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
      <View style={styles.stageRow}>
        <Text style={styles.stage} numberOfLines={1}>
          {stageLabel}
          {'  ·  '}
          {matchDayLabel(match.kickoff_utc, language, t.common.today)}
        </Text>
      </View>

      <View style={styles.main}>
        {/* Home side */}
        <View style={styles.side}>
          <View style={styles.flagScore}>
            <TeamFlag team={home} size={26} showName={false} />
            {decided ? (
              <Text
                style={[
                  styles.score,
                  isLive && styles.scoreLive,
                  homeWin && styles.scoreWin,
                  awayWin && styles.scoreLose,
                ]}>
                {scoreText(h)}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.name, styles.nameLeft]} numberOfLines={1}>
            {teamName(home, language)}
          </Text>
        </View>

        {/* Center status */}
        <View style={styles.center}>
          {isLive ? (
            <LiveBadge match={match} size="sm" />
          ) : isFinished ? (
            <Text style={styles.status}>{t.common.ft}</Text>
          ) : (
            <Text style={styles.statusTime}>
              {formatKickoffTime(match.kickoff_utc, language)}
            </Text>
          )}
        </View>

        {/* Away side */}
        <View style={[styles.side, styles.sideRight]}>
          <View style={[styles.flagScore, styles.flagScoreRight]}>
            {decided ? (
              <Text
                style={[
                  styles.score,
                  isLive && styles.scoreLive,
                  awayWin && styles.scoreWin,
                  isFinished && homeWin && styles.scoreLose,
                ]}>
                {scoreText(a)}
              </Text>
            ) : null}
            <TeamFlag team={away} size={26} showName={false} />
          </View>
          <Text style={[styles.name, styles.nameRight]} numberOfLines={1}>
            {teamName(away, language)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12 },
  stageRow: { alignItems: 'center', marginBottom: 8 },
  stage: {
    color: palette.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  main: { flexDirection: 'row', alignItems: 'flex-start' },
  side: { flex: 1, gap: 4 },
  sideRight: { alignItems: 'flex-end' },
  flagScore: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flagScoreRight: { flexDirection: 'row-reverse' },
  score: {
    color: palette.textSecondary,
    fontSize: 26,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    minWidth: 20,
    textAlign: 'center',
  },
  scoreWin: { color: palette.text },
  scoreLose: { color: palette.textTertiary },
  scoreLive: { color: palette.live },
  name: { color: palette.textSecondary, fontSize: 12, fontWeight: '600', maxWidth: 120 },
  nameLeft: { textAlign: 'left', paddingLeft: 2 },
  nameRight: { textAlign: 'right', paddingRight: 2 },
  center: { paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', minHeight: 26 },
  status: { color: palette.textSecondary, fontSize: 12, fontWeight: '800' },
  statusTime: { color: palette.gold, fontSize: 13, fontWeight: '800' },
});

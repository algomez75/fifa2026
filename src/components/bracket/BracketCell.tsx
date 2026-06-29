import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { TeamFlag } from '@/components/TeamFlag';
import type { Match } from '@/lib/database.types';
import { formatKickoffTime, matchDayLabel } from '@/lib/format';
import type { Language } from '@/lib/i18n';
import type { ResolvedMatch, ResolvedSide } from '@/lib/qualification';
import { teamsById } from '@/lib/seed';
import { palette, radius } from '@/lib/theme';
import type { Translation } from '@/locales/en';

import { CELL_H } from './layout';

interface Props {
  match: Match;
  resolved: ResolvedMatch;
  language: Language;
  t: Translation;
  width: number;
  isFinal?: boolean;
}

/** A compact, presentational bracket match cell (no data hooks). Fixed height so
 *  the tree connectors line up with its vertical center. */
export function BracketCell({ match, resolved, language, t, width, isFinal }: Props) {
  const finished = match.status === 'finished';
  const live = match.status === 'live';
  const when = matchDayLabel(match.kickoff_utc, language, t.common.today);
  const tail = finished ? t.common.ft : live ? t.common.live : formatKickoffTime(match.kickoff_utc, language);

  return (
    <View style={[styles.cell, isFinal && styles.cellFinal, { width, height: CELL_H }]}>
      <Text style={[styles.date, live && styles.dateLive]} numberOfLines={1}>
        {when} · {tail}
      </Text>
      <Row side={resolved.home} score={match.home_score} language={language} />
      <View style={styles.divider} />
      <Row side={resolved.away} score={match.away_score} language={language} />
    </View>
  );
}

function Row({
  side,
  score,
  language,
}: {
  side: ResolvedSide;
  score: number | null;
  language: Language;
}) {
  const team = side.teamId ? teamsById[side.teamId] : undefined;
  return (
    <View style={styles.row}>
      {/* keyed so it pops in the instant a team resolves into the slot */}
      <Animated.View key={side.teamId ?? 'tbd'} entering={FadeIn.duration(420)} style={styles.teamWrap}>
        {team ? (
          <TeamFlag
            team={team}
            size={18}
            showName
            nameStyle={[styles.name, side.isQualified && styles.nameQ]}
          />
        ) : (
          <View style={styles.tbdRow}>
            <View style={styles.tbdDot} />
            <Text style={styles.tbd}>TBD</Text>
          </View>
        )}
      </Animated.View>
      {side.isQualified ? (
        <View style={[styles.qDot, !side.isLocked && styles.qDotProvisional]} />
      ) : null}
      <Text style={styles.score}>{score == null ? '' : score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    backgroundColor: palette.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 9,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  cellFinal: { borderColor: palette.gold, backgroundColor: palette.cardElevated },
  date: {
    color: palette.textTertiary,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  dateLive: { color: palette.live },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  teamWrap: { flex: 1, minWidth: 0 },
  name: { color: palette.text, fontSize: 12.5, fontWeight: '600', flexShrink: 1 },
  nameQ: { fontWeight: '800' },
  tbdRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tbdDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: palette.surface },
  tbd: { color: palette.textTertiary, fontSize: 12.5, fontWeight: '600' },
  qDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.gold },
  qDotProvisional: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: palette.gold,
  },
  score: {
    color: palette.gold,
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    minWidth: 10,
    textAlign: 'right',
  },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: 1 },
});

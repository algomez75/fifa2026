import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Match, Stage } from '@/lib/database.types';
import { formatMatchDay, sideName } from '@/lib/format';
import { palette, radius, stageMeta } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';

interface Props {
  matches: Match[];
}

const COLUMN_ORDER: Stage[] = ['r32', 'r16', 'qf', 'sf', 'final'];

/** Horizontally-scrollable knockout bracket: R32 → R16 → QF → SF → Final. */
export function BracketTree({ matches }: Props) {
  const { t, language } = useTranslation();

  const byStage = (stage: Stage) =>
    matches
      .filter((m) => m.stage === stage)
      .sort((a, b) => (a.match_number ?? 0) - (b.match_number ?? 0));

  const third = matches.find((m) => m.stage === 'third');

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroll}>
      {COLUMN_ORDER.map((stage) => {
        const col = byStage(stage);
        const meta = stageMeta[stage];
        return (
          <View key={stage} style={styles.column}>
            <Text style={styles.colTitle}>
              {language === 'es' ? meta.labelEs : meta.label}
            </Text>
            <View style={styles.colBody}>
              {col.map((m) => (
                <BracketCell key={m.id} match={m} />
              ))}
            </View>
            {stage === 'final' && third ? (
              <View style={styles.thirdWrap}>
                <Text style={styles.thirdTitle}>
                  {language === 'es'
                    ? stageMeta.third.labelEs
                    : stageMeta.third.label}
                </Text>
                <BracketCell match={third} />
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );

  function BracketCell({ match }: { match: Match }) {
    const isFinal = match.stage === 'final';
    return (
      <View style={[styles.cell, isFinal && styles.cellFinal]}>
        <Text style={styles.cellDate}>
          {formatMatchDay(match.kickoff_utc, language)}
        </Text>
        <Row match={match} side="home" />
        <View style={styles.cellDivider} />
        <Row match={match} side="away" />
      </View>
    );
  }

  function Row({ match, side }: { match: Match; side: 'home' | 'away' }) {
    const teamId = side === 'home' ? match.home_team_id : match.away_team_id;
    const placeholder =
      side === 'home' ? match.home_placeholder : match.away_placeholder;
    const score = side === 'home' ? match.home_score : match.away_score;
    const decided = !!teamId;
    return (
      <View style={styles.cellRow}>
        <Text
          style={[styles.cellTeam, !decided && styles.cellTeamTbd]}
          numberOfLines={1}>
          {sideName(teamId, placeholder, language)}
        </Text>
        <Text style={styles.cellScore}>{score == null ? '' : score}</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingVertical: 8, gap: 14 },
  column: { width: 180, gap: 10 },
  colTitle: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  colBody: { gap: 10, flex: 1, justifyContent: 'space-around' },
  cell: {
    backgroundColor: palette.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 10,
  },
  cellFinal: { borderColor: palette.gold, backgroundColor: palette.cardElevated },
  cellDate: {
    color: palette.textTertiary,
    fontSize: 9,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  cellRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  cellTeam: { color: palette.text, fontSize: 13, fontWeight: '600', flex: 1 },
  cellTeamTbd: { color: palette.textTertiary, fontWeight: '500' },
  cellScore: {
    color: palette.gold,
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 8,
    fontVariant: ['tabular-nums'],
  },
  cellDivider: { height: 1, backgroundColor: palette.border, marginVertical: 2 },
  thirdWrap: { marginTop: 18, gap: 8 },
  thirdTitle: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});

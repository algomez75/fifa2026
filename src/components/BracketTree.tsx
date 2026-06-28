import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';

import type { Match, Stage } from '@/lib/database.types';
import { formatMatchDay } from '@/lib/format';
import { resolveMatchTeams } from '@/lib/qualification';
import { teamsById } from '@/lib/seed';
import { palette, radius, stageMeta } from '@/lib/theme';
import { useBracketQualifiers } from '@/hooks/useBracketQualifiers';
import { useTranslation } from '@/store/useAppStore';
import { TeamFlag } from './TeamFlag';

interface Props {
  matches: Match[];
}

const COLUMN_ORDER: Stage[] = ['r32', 'r16', 'qf', 'sf', 'final'];

/** Horizontally-scrollable knockout bracket: R32 → R16 → QF → SF → Final.
 *  Securely-qualified group winners/runners-up are filled into their R32 slots
 *  in real time (Apple-Sports style) via `useBracketQualifiers`. */
export function BracketTree({ matches }: Props) {
  const { t, language } = useTranslation();
  // placeholder ("Winner A" / "Runner-up B") → securely-qualified teamId.
  const qualifiers = useBracketQualifiers(matches);

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
      {COLUMN_ORDER.map((stage, colIndex) => {
        const col = byStage(stage);
        const meta = stageMeta[stage];
        return (
          <Animated.View
            key={stage}
            entering={FadeInDown.delay(colIndex * 70).duration(360)}
            style={styles.column}>
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
          </Animated.View>
        );
      })}
    </ScrollView>
  );

  function BracketCell({ match }: { match: Match }) {
    const isFinal = match.stage === 'final';
    return (
      <Animated.View
        layout={LinearTransition.springify().damping(18)}
        style={[styles.cell, isFinal && styles.cellFinal]}>
        <Text style={styles.cellDate}>
          {formatMatchDay(match.kickoff_utc, language)}
        </Text>
        <Row match={match} side="home" />
        <View style={styles.cellDivider} />
        <Row match={match} side="away" />
      </Animated.View>
    );
  }

  function Row({ match, side }: { match: Match; side: 'home' | 'away' }) {
    const placeholder =
      side === 'home' ? match.home_placeholder : match.away_placeholder;
    const score = side === 'home' ? match.home_score : match.away_score;

    // A mathematically-qualified group team fills the slot before the fixture is
    // officially decided; a server-set team id always wins. `isLocked` = its
    // exact seed (1st/2nd) is fixed; otherwise it's qualified but the seed is
    // still provisional (placed by current order, may swap live). Shared resolver
    // (lib/qualification) so the Schedule fills R32 slots identically.
    const { teamId, isQualified, isLocked } =
      side === 'home'
        ? resolveMatchTeams(match, qualifiers).home
        : resolveMatchTeams(match, qualifiers).away;
    const team = teamId ? teamsById[teamId] : undefined;

    return (
      <View style={styles.cellRow}>
        {/* Keyed so it re-mounts (pops in) the moment a team resolves. */}
        <Animated.View
          key={teamId ?? 'tbd'}
          entering={FadeIn.duration(450)}
          style={styles.teamWrap}>
          {team ? (
            <TeamFlag
              team={team}
              size={18}
              showName
              nameStyle={[styles.cellTeam, isQualified && styles.cellTeamQualified]}
            />
          ) : (
            <Text
              style={[styles.cellTeam, styles.cellTeamTbd]}
              numberOfLines={1}>
              {placeholder ?? 'TBD'}
            </Text>
          )}
        </Animated.View>
        {isQualified ? (
          <View
            style={[styles.qualDot, !isLocked && styles.qualDotProvisional]}
            accessibilityLabel={
              isLocked ? t.groups.qualified : t.groups.qualifiedProvisional
            }
          />
        ) : null}
        <Text style={styles.cellScore}>{score == null ? '' : score}</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  column: { width: 178, gap: 10 },
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
    gap: 6,
  },
  teamWrap: { flex: 1, minWidth: 0 },
  cellTeam: { color: palette.text, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  cellTeamQualified: { color: palette.text, fontWeight: '800' },
  cellTeamTbd: { color: palette.textTertiary, fontWeight: '500' },
  qualDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: palette.gold,
  },
  // Provisional seed: hollow gold ring (qualified to advance, 1st/2nd may swap).
  qualDotProvisional: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: palette.gold,
  },
  cellScore: {
    color: palette.gold,
    fontSize: 13,
    fontWeight: '900',
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

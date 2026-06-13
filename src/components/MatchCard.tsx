import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { Match, Prediction } from '@/lib/database.types';
import { type GoalEvent, useMatchCards, useMatchGoals } from '@/hooks/useMatchEvents';
import { formatKickoffTime, formatMatchDay, sideName } from '@/lib/format';
import { scorePrediction } from '@/lib/scoring';
import { palette, radius, stageMeta } from '@/lib/theme';
import { teamsById, venuesById } from '@/lib/seed';
import { useTranslation } from '@/store/useAppStore';
import { Avatar } from './Avatar';
import { LiveBadge } from './LiveBadge';
import { TeamFlag } from './TeamFlag';

interface Props {
  match: Match;
  onPress?: (m: Match) => void;
  compact?: boolean;
  /** Optional: the current user's prediction for this match (shows a badge). */
  prediction?: Prediction | null;
}

export function MatchCard({ match, onPress, compact, prediction }: Props) {
  const { t, language } = useTranslation();
  const predResult = prediction ? scorePrediction(prediction, match) : null;
  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const goals = useMatchGoals(match.id, match.home_team_id);
  const cards = useMatchCards(match.id, match.home_team_id);
  const showGoals = !compact && (isLive || isFinished) && (goals.all.length > 0 || cards.any);

  const home = match.home_team_id ? teamsById[match.home_team_id] : undefined;
  const away = match.away_team_id ? teamsById[match.away_team_id] : undefined;
  const venue = match.venue_id ? venuesById[match.venue_id] : undefined;
  const accent = venue?.color ?? palette.gold;

  // Breathing glow while live.
  const glow = useSharedValue(0);
  useEffect(() => {
    if (isLive) {
      glow.value = withRepeat(withTiming(1, { duration: 1300 }), -1, true);
    } else {
      glow.value = withTiming(0, { duration: 200 });
    }
  }, [isLive, glow]);

  const glowStyle = useAnimatedStyle(() => ({
    borderColor: isLive
      ? `rgba(226,75,74,${0.3 + glow.value * 0.5})`
      : palette.border,
    shadowOpacity: isLive ? 0.25 + glow.value * 0.45 : 0,
  }));

  const stage = stageMeta[match.stage];
  const groupLabel =
    match.stage === 'group' && match.group_letter
      ? `${t.groups.group} ${match.group_letter}`
      : (language === 'es' ? stage?.labelEs : stage?.label) ?? '';

  const scoreText = (s: number | null) => (s == null ? '–' : String(s));

  return (
    <Pressable
      onPress={() => onPress?.(match)}
      style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
      <Animated.View
        style={[styles.card, compact && styles.cardCompact, glowStyle]}>
        <View style={[styles.accentBar, { backgroundColor: accent }]} />

        {compact ? (
          <>
            <View style={styles.topRow}>
              <Text style={styles.stage} numberOfLines={1}>
                {groupLabel}
              </Text>
              {isLive ? (
                <LiveBadge minute={match.minute} size="sm" />
              ) : isFinished ? (
                <Text style={styles.ft}>{t.common.ft}</Text>
              ) : (
                <Text style={styles.dayTime} numberOfLines={1}>
                  <Text style={styles.dayInline}>
                    {formatMatchDay(match.kickoff_utc, language)}
                  </Text>
                  {'   '}
                  {formatKickoffTime(match.kickoff_utc, language)}
                </Text>
              )}
            </View>

            <View style={styles.stack}>
              <View style={styles.stackRow}>
                {home ? (
                  <TeamFlag
                    team={home}
                    size={22}
                    nameStyle={styles.stackName}
                    style={styles.stackTeam}
                  />
                ) : (
                  <Text style={styles.stackPlaceholder} numberOfLines={1}>
                    {sideName(match.home_team_id, match.home_placeholder, language)}
                  </Text>
                )}
                {isLive || isFinished ? (
                  <Text style={[styles.stackScore, isLive && styles.scoreLive]}>
                    {scoreText(match.home_score)}
                  </Text>
                ) : null}
              </View>

              <View style={styles.stackRow}>
                {away ? (
                  <TeamFlag
                    team={away}
                    size={22}
                    nameStyle={styles.stackName}
                    style={styles.stackTeam}
                  />
                ) : (
                  <Text style={styles.stackPlaceholder} numberOfLines={1}>
                    {sideName(match.away_team_id, match.away_placeholder, language)}
                  </Text>
                )}
                {isLive || isFinished ? (
                  <Text style={[styles.stackScore, isLive && styles.scoreLive]}>
                    {scoreText(match.away_score)}
                  </Text>
                ) : null}
              </View>
            </View>
          </>
        ) : (
          <>
        <View style={styles.topRow}>
          <Text style={styles.stage}>{groupLabel}</Text>
          {isLive ? (
            <LiveBadge minute={match.minute} size="sm" />
          ) : isFinished ? (
            <Text style={styles.ft}>{t.common.ft}</Text>
          ) : (
            <Text style={styles.time}>
              {formatKickoffTime(match.kickoff_utc, language)}
            </Text>
          )}
        </View>

        <View style={styles.teamsRow}>
          <View style={styles.side}>
            <TeamFlag team={home} size={26} nameStyle={styles.teamName} />
          </View>

          <View style={styles.scoreBox}>
            {isLive || isFinished ? (
              <Text style={[styles.score, isLive && styles.scoreLive]}>
                {scoreText(match.home_score)}
                <Text style={styles.scoreSep}> : </Text>
                {scoreText(match.away_score)}
              </Text>
            ) : (
              <Text style={styles.vs}>{t.common.vs}</Text>
            )}
            {match.home_score_penalties != null &&
            match.away_score_penalties != null ? (
              <Text style={styles.pens}>
                ({match.home_score_penalties}-{match.away_score_penalties} pen)
              </Text>
            ) : null}
          </View>

          <View style={[styles.side, styles.sideRight]}>
            <TeamFlag
              team={away}
              size={26}
              reverse
              nameStyle={[styles.teamName, styles.teamNameRight]}
            />
          </View>
        </View>

        {/* Placeholder names for undecided knockout matches */}
        {!home || !away ? (
          <View style={styles.placeholderRow}>
            <Text style={styles.placeholder} numberOfLines={1}>
              {sideName(match.home_team_id, match.home_placeholder, language)}
            </Text>
            <Text style={styles.placeholder} numberOfLines={1}>
              {sideName(match.away_team_id, match.away_placeholder, language)}
            </Text>
          </View>
        ) : null}

        {/* Goal scorers + cards — minimalist avatars + minutes, split by side */}
        {showGoals ? (
          <View style={styles.goalsRow}>
            <View style={styles.goalsCol}>
              {goals.home.map((g) => (
                <ScorerRow key={g.id} goal={g} />
              ))}
              {cards.homeReds.map((c) => (
                <RedCardRow key={c.id} card={c} />
              ))}
              {cards.homeYellows > 0 ? (
                <Text style={styles.yellowCount}>🟨 ×{cards.homeYellows}</Text>
              ) : null}
            </View>
            <View style={[styles.goalsCol, styles.goalsColRight]}>
              {goals.away.map((g) => (
                <ScorerRow key={g.id} goal={g} right />
              ))}
              {cards.awayReds.map((c) => (
                <RedCardRow key={c.id} card={c} right />
              ))}
              {cards.awayYellows > 0 ? (
                <Text style={styles.yellowCount}>🟨 ×{cards.awayYellows}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {venue && !compact ? (
          <Text style={styles.venue} numberOfLines={1}>
            {venue.name} · {venue.city}
          </Text>
        ) : null}

        {prediction ? (
          <View style={styles.predRow}>
            <Text style={styles.predLabel}>{t.predict.title}</Text>
            <Text style={styles.predScore}>
              {prediction.home_pred}–{prediction.away_pred}
            </Text>
            {predResult && predResult.outcome !== 'pending' ? (
              <Text
                style={[
                  styles.predPts,
                  predResult.outcome === 'exact' && { color: palette.gold },
                  predResult.outcome === 'result' && { color: palette.success },
                  predResult.outcome === 'miss' && { color: palette.textTertiary },
                ]}>
                +{predResult.points}
              </Text>
            ) : null}
          </View>
        ) : null}
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

function RedCardRow({ card, right }: { card: GoalEvent; right?: boolean }) {
  const minute = card.minute != null ? ` ${card.minute}′` : '';
  return (
    <View style={[styles.scorer, right && styles.scorerRight]}>
      <Text style={styles.redCardText} numberOfLines={1}>
        {right ? `${card.player_name ?? ''}${minute} 🟥` : `🟥 ${card.player_name ?? ''}${minute}`}
      </Text>
    </View>
  );
}

function ScorerRow({ goal, right }: { goal: GoalEvent; right?: boolean }) {
  const name = goal.player_name ?? '';
  const minute = goal.minute != null ? ` ${goal.minute}′` : '';
  return (
    <View style={[styles.scorer, right && styles.scorerRight]}>
      {!right ? <Avatar url={goal.player_photo} name={name} size={18} ring={false} /> : null}
      <Text style={styles.scorerText} numberOfLines={1}>
        {right ? `${name}${minute}` : `${name}${minute}`}
      </Text>
      {right ? <Avatar url={goal.player_photo} name={name} size={18} ring={false} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    paddingLeft: 18,
    overflow: 'hidden',
    shadowColor: palette.live,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  cardCompact: { padding: 12, paddingLeft: 16, width: 250 },
  accentBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stage: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  time: { color: palette.gold, fontSize: 14, fontWeight: '800' },
  ft: { color: palette.textSecondary, fontSize: 12, fontWeight: '800' },
  // Compact (home Today / Upcoming): Apple-Sports vertical stack — full names
  // get the whole card width, date + time live in the header.
  dayTime: { color: palette.gold, fontSize: 13, fontWeight: '800', flexShrink: 1, textAlign: 'right' },
  dayInline: { color: palette.textSecondary, fontSize: 12, fontWeight: '700' },
  stack: { gap: 12, marginTop: 2 },
  stackRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stackTeam: { flex: 1 },
  stackName: { fontSize: 15, fontWeight: '700' },
  stackScore: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    minWidth: 22,
    textAlign: 'right',
  },
  stackPlaceholder: { color: palette.textTertiary, fontSize: 13, flex: 1 },
  teamsRow: { flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  sideRight: { justifyContent: 'flex-end' },
  teamName: { fontSize: 15, fontWeight: '700' },
  teamNameRight: { textAlign: 'right' },
  scoreBox: { alignItems: 'center', minWidth: 74, paddingHorizontal: 6 },
  score: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  scoreLive: { color: palette.live },
  scoreSep: { color: palette.textTertiary },
  vs: { color: palette.textTertiary, fontSize: 13, fontWeight: '700' },
  pens: { color: palette.textSecondary, fontSize: 10, marginTop: 2 },
  placeholderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  placeholder: { color: palette.textTertiary, fontSize: 11, flex: 1 },
  venue: {
    color: palette.textTertiary,
    fontSize: 12,
    marginTop: 12,
  },
  goalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  goalsCol: { flex: 1, gap: 5 },
  goalsColRight: { alignItems: 'flex-end' },
  scorer: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  scorerRight: { justifyContent: 'flex-end' },
  scorerText: { color: palette.textSecondary, fontSize: 12, flexShrink: 1 },
  redCardText: { color: palette.live, fontSize: 11, fontWeight: '700', flexShrink: 1 },
  yellowCount: { color: palette.textTertiary, fontSize: 11 },
  predRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  predLabel: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  predScore: { color: palette.text, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  predPts: { fontSize: 13, fontWeight: '900' },
});


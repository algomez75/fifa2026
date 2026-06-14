import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { type GoalEvent, useMatchCards, useMatchGoals } from '@/hooks/useMatchEvents';
import type { Match } from '@/lib/database.types';
import { teamName } from '@/lib/format';
import { teamsById, venuesById } from '@/lib/seed';
import { palette, radius, stageMeta } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';
import { Avatar } from './Avatar';
import { GlassCard } from './GlassCard';
import { LiveBadge } from './LiveBadge';
import { TeamFlag } from './TeamFlag';

const SCREEN_PAD = 20; // home scroll horizontal padding
const CARD_GAP = 12;

interface Props {
  matches: Match[];
  onPressMatch?: (m: Match) => void;
}

/**
 * Home hero while matches are LIVE: a TV-style scoreboard per match — breathing
 * live glow, big animated score that pops on every goal, scorer rows with the
 * player's circular avatar, venue footer. Multiple simultaneous matches become
 * a snap carousel with pagination dots.
 */
export function LiveHero({ matches, onPressMatch }: Props) {
  const [page, setPage] = useState(0);
  const width = Dimensions.get('window').width;
  const single = matches.length === 1;
  // Card width: full width when single; a peek of the next card when many.
  const cardWidth = single ? width - SCREEN_PAD * 2 : width - SCREEN_PAD * 2 - 28;

  if (single) {
    return <LiveMatchBoard match={matches[0]} width={cardWidth} onPress={onPressMatch} />;
  }

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={{ gap: CARD_GAP, paddingRight: 28 }}
        onScroll={(e) =>
          setPage(Math.round(e.nativeEvent.contentOffset.x / (cardWidth + CARD_GAP)))
        }
        scrollEventThrottle={32}>
        {matches.map((m) => (
          <LiveMatchBoard key={m.id} match={m} width={cardWidth} onPress={onPressMatch} />
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {matches.map((m, i) => (
          <View key={m.id} style={[styles.dot, i === page && styles.dotOn]} />
        ))}
      </View>
    </View>
  );
}

function LiveMatchBoard({
  match,
  width,
  onPress,
}: {
  match: Match;
  width: number;
  onPress?: (m: Match) => void;
}) {
  const { t, language } = useTranslation();
  const home = match.home_team_id ? teamsById[match.home_team_id] : undefined;
  const away = match.away_team_id ? teamsById[match.away_team_id] : undefined;
  const venue = match.venue_id ? venuesById[match.venue_id] : undefined;
  const goals = useMatchGoals(match.id, match.home_team_id);
  const cards = useMatchCards(match.id, match.home_team_id);

  const stage = stageMeta[match.stage];
  const stageLabel =
    match.stage === 'group' && match.group_letter
      ? `${t.groups.group} ${match.group_letter}`
      : (language === 'es' ? stage?.labelEs : stage?.label) ?? '';

  // Breathing live glow around the card.
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 1400 }), -1, true);
  }, [glow]);
  const glowStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(226,75,74,${0.35 + glow.value * 0.45})`,
    shadowOpacity: 0.3 + glow.value * 0.4,
  }));

  // Score pops when it changes (a goal!).
  const pop = useSharedValue(1);
  const scoreKey = `${match.home_score ?? 0}-${match.away_score ?? 0}`;
  const prevScore = useRef(scoreKey);
  useEffect(() => {
    if (prevScore.current !== scoreKey) {
      prevScore.current = scoreKey;
      pop.value = withSequence(withSpring(1.35, { damping: 5 }), withSpring(1));
    }
  }, [scoreKey, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Pressable
      onPress={() => onPress?.(match)}
      style={({ pressed }) => [{ width }, pressed && { opacity: 0.9 }]}>
      <Animated.View style={[styles.board, glowStyle]}>
        <GlassCard intensity={30} style={styles.glass}>
          <View style={styles.topRow}>
            <Text style={styles.stage}>{stageLabel}</Text>
            <LiveBadge match={match} />
          </View>

          <View style={styles.scoreRow}>
            <View style={styles.team}>
              <TeamFlag team={home} size={44} showName={false} />
              <Text style={styles.teamName} numberOfLines={1}>
                {teamName(home, language)}
                {cards.homeReds.length ? ` ${'🟥'.repeat(cards.homeReds.length)}` : ''}
              </Text>
            </View>

            <Animated.Text style={[styles.score, popStyle]}>
              {match.home_score ?? 0}
              <Text style={styles.scoreSep}>:</Text>
              {match.away_score ?? 0}
            </Animated.Text>

            <View style={styles.team}>
              <TeamFlag team={away} size={44} showName={false} />
              <Text style={styles.teamName} numberOfLines={1}>
                {teamName(away, language)}
                {cards.awayReds.length ? ` ${'🟥'.repeat(cards.awayReds.length)}` : ''}
              </Text>
            </View>
          </View>

          {goals.all.length > 0 ? (
            <View style={styles.goals}>
              <View style={styles.goalsCol}>
                {goals.home.map((g) => (
                  <Scorer key={g.id} goal={g} />
                ))}
              </View>
              <View style={[styles.goalsCol, styles.goalsColRight]}>
                {goals.away.map((g) => (
                  <Scorer key={g.id} goal={g} right />
                ))}
              </View>
            </View>
          ) : null}

          {venue ? (
            <Text style={styles.venue} numberOfLines={1}>
              📍 {venue.name} · {venue.city}
            </Text>
          ) : null}
        </GlassCard>
      </Animated.View>
    </Pressable>
  );
}

function Scorer({ goal, right }: { goal: GoalEvent; right?: boolean }) {
  const name = goal.player_name ?? '';
  const minute = goal.minute != null ? ` ${goal.minute}′` : '';
  return (
    <View style={[styles.scorer, right && styles.scorerRight]}>
      {!right ? <Avatar url={goal.player_photo} name={name} size={20} ring={false} /> : null}
      <Text style={styles.scorerText} numberOfLines={1}>
        {name}
        <Text style={styles.scorerMin}>{minute}</Text>
      </Text>
      {right ? <Avatar url={goal.player_photo} name={name} size={20} ring={false} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    shadowColor: palette.live,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  glass: { borderWidth: 0 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  stage: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  team: { flex: 1, alignItems: 'center', gap: 8 },
  teamName: { color: palette.text, fontSize: 14, fontWeight: '800', maxWidth: 110 },
  score: {
    color: palette.text,
    fontSize: 44,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
    paddingHorizontal: 10,
  },
  scoreSep: { color: palette.live, fontWeight: '900' },
  goals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  goalsCol: { flex: 1, gap: 6 },
  goalsColRight: { alignItems: 'flex-end' },
  scorer: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  scorerRight: { justifyContent: 'flex-end' },
  scorerText: { color: palette.text, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  scorerMin: { color: palette.gold, fontWeight: '800' },
  venue: { color: palette.textTertiary, fontSize: 12, marginTop: 14 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.border,
  },
  dotOn: { backgroundColor: palette.live, width: 16 },
});

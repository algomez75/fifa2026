import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { Match } from '@/lib/database.types';
import { useLiveClock } from '@/hooks/useLiveClock';
import { palette, radius } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';

/**
 * Pulsing LIVE pill with a breathing dot and a **locally-ticking minute**
 * (via `useLiveClock`). Reflects the real stage: during extra time it shows
 * "Extra Time" + the 105'/120' clock; a paused break switches to an amber
 * "Half Time" / "Extra Time" / "Penalties" pill (compact short forms) with a
 * steady dot.
 */
export function LiveBadge({ match, size = 'md' }: { match: Match; size?: 'sm' | 'md' }) {
  const { t } = useTranslation();
  const { isHalfTime, isExtraTimeBreak, isExtraTime, isPenalties, clock } = useLiveClock(match);
  const pulse = useSharedValue(1);
  const small = size === 'sm';
  // Half-time, the extra-time break, and the penalty shootout are all "paused" —
  // steady amber pill, no ticking clock.
  const paused = isHalfTime || isExtraTimeBreak || isPenalties;

  useEffect(() => {
    if (paused) {
      pulse.value = withTiming(1, { duration: 200 }); // steady while paused
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 700 }),
        withTiming(1, { duration: 700 }),
      ),
      -1,
      false,
    );
  }, [pulse, paused]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const label = isPenalties
    ? small
      ? t.common.penaltiesShort
      : t.common.penalties
    : isExtraTimeBreak
      ? small
        ? t.common.extraTimeShort
        : t.common.extraTime
      : isHalfTime
        ? small
          ? t.common.halfTimeShort
          : t.common.halfTime
        : isExtraTime
          ? // extra time in play — short "ET"/"TE" tag + the ticking 105'/120' clock
            `${t.common.extraTimeShort}${clock ? ` ${clock}` : ''}`
          : `${t.common.live}${clock ? ` ${clock}` : ''}`;

  return (
    <Animated.View style={[styles.pill, small && styles.pillSm, paused && styles.pillHt]}>
      <Animated.View style={[styles.dot, paused && styles.dotHt, dotStyle]} />
      <Text style={[styles.text, small && styles.textSm, paused && styles.textHt]}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.liveDim,
    borderColor: palette.live,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  pillSm: { paddingHorizontal: 8, paddingVertical: 2, gap: 4 },
  pillHt: { backgroundColor: palette.goldDim, borderColor: palette.gold },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.live },
  dotHt: { backgroundColor: palette.gold },
  text: { color: palette.live, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  textSm: { fontSize: 10 },
  textHt: { color: palette.gold },
});

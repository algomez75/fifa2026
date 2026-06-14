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
 * (via `useLiveClock`). At half-time it switches to an amber "Half Time"
 * (full text) / "HT" (compact) pill with a steady dot.
 */
export function LiveBadge({ match, size = 'md' }: { match: Match; size?: 'sm' | 'md' }) {
  const { t } = useTranslation();
  const { isHalfTime, text } = useLiveClock(match);
  const pulse = useSharedValue(1);
  const small = size === 'sm';

  useEffect(() => {
    if (isHalfTime) {
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
  }, [pulse, isHalfTime]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const label = isHalfTime
    ? small
      ? t.common.halfTimeShort
      : t.common.halfTime
    : `${t.common.live}${text ? ` ${text}'` : ''}`;

  return (
    <Animated.View style={[styles.pill, small && styles.pillSm, isHalfTime && styles.pillHt]}>
      <Animated.View style={[styles.dot, isHalfTime && styles.dotHt, dotStyle]} />
      <Text style={[styles.text, small && styles.textSm, isHalfTime && styles.textHt]}>
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

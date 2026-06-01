import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { palette, radius } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';

/** Pulsing LIVE pill with a breathing dot. */
export function LiveBadge({
  minute,
  size = 'md',
}: {
  minute?: number | null;
  size?: 'sm' | 'md';
}) {
  const { t } = useTranslation();
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 700 }),
        withTiming(1, { duration: 700 }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const small = size === 'sm';

  return (
    <Animated.View style={[styles.pill, small && styles.pillSm]}>
      <Animated.View style={[styles.dot, dotStyle]} />
      <Text style={[styles.text, small && styles.textSm]}>
        {t.common.live}
        {minute != null ? ` ${minute}'` : ''}
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
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.live },
  text: { color: palette.live, fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  textSm: { fontSize: 10 },
});

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { palette, radius } from '@/lib/theme';

const LABELS = ['GS', 'R32', 'R16', 'QF', 'SF', 'F'];

/**
 * Apple-Sports bracket header: six evenly-spaced stage labels with a translucent
 * 2-cell window that slides in lockstep with the bracket's horizontal scroll
 * (GS+R32 → R32+R16 → … → SF+F). Tapping a label jumps the bracket there.
 */
export function BracketNavigator({
  scrollX,
  colW,
  onJump,
}: {
  scrollX: SharedValue<number>;
  colW: number;
  onJump: (i: number) => void;
}) {
  const [trackW, setTrackW] = useState(0);
  const slot = trackW / LABELS.length;
  const maxScroll = colW * (LABELS.length - 2); // 4 * colW

  const windowStyle = useAnimatedStyle(() => ({
    opacity: trackW > 0 ? 1 : 0,
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          [0, maxScroll],
          [0, slot * (LABELS.length - 2)],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.track} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.window, { width: slot * 2 }, windowStyle]} pointerEvents="none">
          <Text style={styles.chevron}>‹</Text>
          <Text style={styles.chevron}>›</Text>
        </Animated.View>
        {LABELS.map((l, i) => (
          <Pressable key={l} style={styles.slot} onPress={() => onJump(i)} hitSlop={6}>
            <NavLabel label={l} index={i} scrollX={scrollX} colW={colW} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function NavLabel({
  label,
  index,
  scrollX,
  colW,
}: {
  label: string;
  index: number;
  scrollX: SharedValue<number>;
  colW: number;
}) {
  const textStyle = useAnimatedStyle(() => {
    // Window center in label-index space is scrollX/colW + 0.5; labels within ~1
    // of it (the two under the window) read as white, the rest dim.
    const dist = Math.abs(index - (scrollX.value / colW + 0.5));
    return {
      color: interpolateColor(dist, [0.6, 1.1], [palette.white, palette.textTertiary], 'RGB'),
    };
  });
  return <Animated.Text style={[styles.label, textStyle]}>{label}</Animated.Text>;
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginBottom: 12 },
  track: {
    flexDirection: 'row',
    height: 40,
    backgroundColor: palette.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  window: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 0,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  chevron: { color: palette.text, fontSize: 15, fontWeight: '800', opacity: 0.6 },
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
});

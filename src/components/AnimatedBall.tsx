import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { hostColors, palette } from '@/lib/theme';

/**
 * Minimalist "real" soccer ball (TRIONDA-style tri-color panels) used as the
 * notifications entry point. It rolls + bounces while there are unread alerts
 * and does a celebratory pop-spin when a new one arrives. A traditional red
 * count badge sits on top-right like a classic bell.
 */
export function AnimatedBall({
  count,
  onPress,
  size = 22,
}: {
  count: number;
  onPress: () => void;
  size?: number;
}) {
  const bounce = useSharedValue(0); // vertical hop (px)
  const spin = useSharedValue(0); // continuous rolling (deg)
  const kick = useSharedValue(0); // one-shot extra spin on a new alert (deg)
  const pop = useSharedValue(1); // scale punch on a new alert
  const rolling = useRef(false);
  const prev = useRef(count);

  // Roll + bounce continuously while there's something unread; rest when clear.
  useEffect(() => {
    if (count > 0 && !rolling.current) {
      rolling.current = true;
      spin.value = withRepeat(
        withTiming(360, { duration: 3600, easing: Easing.linear }),
        -1,
        false,
      );
      bounce.value = withRepeat(
        withSequence(
          withTiming(-3.5, { duration: 420, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 420, easing: Easing.bounce }),
        ),
        -1,
        false,
      );
    } else if (count === 0 && rolling.current) {
      rolling.current = false;
      cancelAnimation(spin);
      cancelAnimation(bounce);
      spin.value = withTiming(0, { duration: 220 });
      bounce.value = withTiming(0, { duration: 160 });
    }
  }, [count, spin, bounce]);

  // Celebrate a brand-new alert: a quick extra spin + a scale pop.
  useEffect(() => {
    if (count > prev.current) {
      kick.value = 0;
      kick.value = withTiming(360, { duration: 720, easing: Easing.out(Easing.cubic) });
      pop.value = withSequence(
        withTiming(1.32, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 320, easing: Easing.elastic(1.4) }),
      );
    }
    prev.current = count;
  }, [count, kick, pop]);

  const ballStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bounce.value },
      { scale: pop.value },
      { rotate: `${spin.value + kick.value}deg` },
    ],
  }));

  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.wrap}>
      <Animated.View style={ballStyle}>
        <SoccerBall size={size} />
      </Animated.View>
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Real-ball look: off-white body, dark central pentagon + radial seams, and an
 * outer pentagon whose five edges cycle the host trio (USA blue / Mexico green /
 * Canada red) as a nod to the official TRIONDA matchball.
 */
function SoccerBall({ size }: { size: number }) {
  const dark = palette.bg;
  const blue = hostColors.USA.bright;
  const green = hostColors.Mexico.bright;
  const red = hostColors.Canada.bright;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* ball body */}
      <Circle cx={12} cy={12} r={10} fill="#F4F6FA" stroke={dark} strokeWidth={1} />

      {/* outer pentagon edges — tri-color TRIONDA accent */}
      <Path d="M12 3.8 19.8 9.47" stroke={blue} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M19.8 9.47 16.82 18.63" stroke={green} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M16.82 18.63 7.18 18.63" stroke={red} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M7.18 18.63 4.2 9.47" stroke={blue} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M4.2 9.47 12 3.8" stroke={green} strokeWidth={1.5} strokeLinecap="round" />

      {/* radial seams from the center pentagon out to the rim */}
      <Path
        d="M12 9 V3.8 M14.85 11.07 19.8 9.47 M13.76 14.43 16.82 18.63 M10.24 14.43 7.18 18.63 M9.15 11.07 4.2 9.47"
        stroke={dark}
        strokeWidth={1.3}
        strokeLinecap="round"
      />

      {/* central pentagon */}
      <Path
        d="M12 9 L14.85 11.07 L13.76 14.43 L10.24 14.43 L9.15 11.07 Z"
        fill={dark}
        stroke={dark}
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: palette.live,
    borderWidth: 2,
    borderColor: palette.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
});

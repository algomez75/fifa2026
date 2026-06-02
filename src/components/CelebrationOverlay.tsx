import LottieView from 'lottie-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { palette } from '@/lib/theme';
import { useCelebration } from '@/store/useCelebration';

const SOURCES = {
  goal: require('@/assets/animations/goal.json'),
  result: require('@/assets/animations/trophy.json'),
  challenge: require('@/assets/animations/goal.json'),
} as const;

/**
 * Root-level celebration overlay driven by the {@link useCelebration} store.
 * Plays the matching Lottie burst for goals / final results / challenges and
 * auto-dismisses. Mounted once in the root layout so any screen — or a push
 * arriving in the foreground — can trigger it.
 */
export function CelebrationOverlay() {
  const current = useCelebration((s) => s.current);
  const clear = useCelebration((s) => s.clear);

  useEffect(() => {
    if (!current) return;
    const id = setTimeout(clear, 2800);
    return () => clearTimeout(id);
  }, [current, clear]);

  if (!current) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(300)}
      style={styles.overlay}
      pointerEvents="none">
      <LottieView source={SOURCES[current.kind]} autoPlay loop={false} style={styles.lottie} />
      <View style={styles.textWrap}>
        <Text style={styles.title}>{current.title}</Text>
        {current.label ? <Text style={styles.label}>{current.label}</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,14,26,0.75)',
    zIndex: 100,
  },
  lottie: { width: 280, height: 280, position: 'absolute' },
  textWrap: { alignItems: 'center' },
  title: {
    color: palette.gold,
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
  },
  label: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});

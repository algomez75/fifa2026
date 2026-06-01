import LottieView from 'lottie-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { palette } from '@/lib/theme';

/** Full-screen GOAL! celebration with a Lottie burst. Auto-dismisses. */
export function GoalOverlay({
  visible,
  label,
  onDone,
}: {
  visible: boolean;
  label?: string;
  onDone: () => void;
}) {
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(onDone, 2600);
    return () => clearTimeout(id);
  }, [visible, onDone]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(300)}
      style={styles.overlay}
      pointerEvents="none">
      <LottieView
        source={require('@/assets/animations/goal.json')}
        autoPlay
        loop={false}
        style={styles.lottie}
      />
      <View style={styles.textWrap}>
        <Text style={styles.goal}>GOAL!</Text>
        {label ? <Text style={styles.label}>{label}</Text> : null}
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
  lottie: { width: 260, height: 260, position: 'absolute' },
  textWrap: { alignItems: 'center' },
  goal: {
    color: palette.gold,
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 2,
  },
  label: { color: palette.text, fontSize: 16, fontWeight: '700', marginTop: 4 },
});

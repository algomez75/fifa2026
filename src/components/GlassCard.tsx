import { BlurView } from 'expo-blur';
import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { palette, radius } from '@/lib/theme';

interface Props {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  intensity?: number;
  /** Optional accent color for a thin left bar (host-city identity). */
  accent?: string;
  padded?: boolean;
}

/** Glassmorphism card: blurred translucent surface with a hairline border. */
export function GlassCard({
  children,
  style,
  intensity = 24,
  accent,
  padded = true,
}: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <BlurView
        intensity={intensity}
        tint="dark"
        style={[styles.blur, padded && styles.padded]}>
        {accent ? (
          <View style={[styles.accent, { backgroundColor: accent }]} />
        ) : null}
        {children}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.glassBorder,
    backgroundColor: palette.glass,
  },
  blur: { borderRadius: radius.lg, overflow: 'hidden' },
  padded: { padding: 16 },
  accent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
  },
});

import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { palette } from '@/lib/theme';

/** Translucent gradient wash from a city/host accent color into the page bg. */
export function GradientHeader({
  color,
  children,
  style,
  height,
}: {
  color: string;
  children?: React.ReactNode;
  style?: ViewStyle;
  height?: number;
}) {
  return (
    <View style={[{ overflow: 'hidden' }, height ? { height } : null, style]}>
      <LinearGradient
        colors={[color + 'CC', color + '55', palette.bg]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

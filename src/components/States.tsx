import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTranslation } from '@/store/useAppStore';
import { palette, radius } from '@/lib/theme';

/** Centered spinner with a label. */
export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={palette.gold} size="large" />
      <Text style={styles.muted}>{label ?? t.common.loading}</Text>
    </View>
  );
}

/** Error state with retry. */
export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <Text style={styles.emoji}>⚠️</Text>
      <Text style={styles.title}>{t.common.errorTitle}</Text>
      <Text style={styles.muted}>{t.common.errorBody}</Text>
      {onRetry ? (
        <Pressable style={styles.retry} onPress={onRetry}>
          <Text style={styles.retryText}>{t.common.retry}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Empty state with optional custom copy. */
export function EmptyState({
  title,
  subtitle,
  emoji = '🗓️',
}: {
  title?: string;
  subtitle?: string;
  emoji?: string;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.center}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title ?? t.common.emptyTitle}</Text>
      {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
    </View>
  );
}

/** Shimmering skeleton block for loading placeholders. */
export function Skeleton({
  height = 72,
  width = '100%',
  style,
}: {
  height?: number;
  width?: number | `${number}%`;
  style?: object;
}) {
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.85, { duration: 800 }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        { height, width, borderRadius: radius.md, backgroundColor: palette.card },
        animated,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
    minHeight: 240,
  },
  emoji: { fontSize: 40, marginBottom: 4 },
  title: { color: palette.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  muted: { color: palette.textSecondary, fontSize: 14, textAlign: 'center' },
  retry: {
    marginTop: 12,
    backgroundColor: palette.goldDim,
    borderColor: palette.gold,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  retryText: { color: palette.gold, fontWeight: '700' },
});

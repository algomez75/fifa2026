import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GroupsIcon,
  HistoryIcon,
  HomeIcon,
  type IconProps,
  ScheduleIcon,
  TeamsIcon,
  TrophyIcon,
} from '@/components/icons';
import { palette, radius } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';

const ICONS: Record<string, (p: IconProps) => React.ReactNode> = {
  index: HomeIcon,
  schedule: ScheduleIcon,
  groups: GroupsIcon,
  teams: TeamsIcon,
  history: HistoryIcon,
  leaderboard: TrophyIcon,
};

/** Floating glass tab bar with an animated active pill + label reveal.
 *  Receives the standard React Navigation bottom-tab bar props from Expo Router. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const labels: Record<string, string> = {
    index: t.tabs.home,
    schedule: t.tabs.schedule,
    groups: t.tabs.groups,
    teams: t.tabs.teams,
    history: t.tabs.history,
    leaderboard: t.tabs.leaderboard,
  };

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + 10 }]}>
      <BlurView intensity={40} tint="dark" style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const Icon = ICONS[route.name];
          if (!Icon) return null;

          const onPress = () => {
            Haptics.selectionAsync();
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TabItem
              key={route.key}
              focused={focused}
              onPress={onPress}
              Icon={Icon}
              label={labels[route.name] ?? route.name}
            />
          );
        })}
      </BlurView>
    </View>
  );
}

function TabItem({
  focused,
  onPress,
  Icon,
  label,
}: {
  focused: boolean;
  onPress: () => void;
  Icon: (p: IconProps) => React.ReactNode;
  label: string;
}) {
  const active = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    active.value = withTiming(focused ? 1 : 0, { duration: 220 });
  }, [focused, active]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: active.value,
    transform: [{ scale: 0.85 + active.value * 0.15 }],
  }));

  return (
    <Pressable onPress={onPress} style={styles.item} hitSlop={6}>
      <Animated.View style={[styles.pill, pillStyle]} />
      <Icon color={focused ? palette.gold : palette.textTertiary} size={23} strokeWidth={focused ? 2.4 : 2} />
      <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  bar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 460,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.glassBorder,
    backgroundColor: 'rgba(20,25,41,0.7)',
    overflow: 'hidden',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 2 },
  pill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: palette.goldDim,
    borderRadius: radius.lg,
    margin: 2,
  },
  label: { fontSize: 9.5, fontWeight: '700', color: palette.textTertiary, letterSpacing: 0.3 },
  labelActive: { color: palette.gold },
});

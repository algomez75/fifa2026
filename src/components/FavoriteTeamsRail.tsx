import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import Animated, {
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { teamsById } from '@/lib/seed';
import { Flag } from './Flag';
import { palette } from '@/lib/theme';

const CIRCLE = 56;

interface Props {
  /** Favourite team ids (in the order the user picked them). */
  teamIds: string[];
  /** Tap a team → its page (group standing + results). */
  onPressTeam: (teamId: string) => void;
}

/**
 * Minimalist horizontal carousel of favourite-team flags. Each chip is a
 * circular flag with a gold ring that springs on press and slides in on mount,
 * bleeding edge-to-edge so it barely costs vertical space.
 */
export function FavoriteTeamsRail({ teamIds, onPressTeam }: Props) {
  const ids = teamIds.filter((id) => teamsById[id]);
  if (!ids.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.rail}
      contentContainerStyle={styles.content}>
      {ids.map((id, i) => (
        <FlagChip key={id} teamId={id} index={i} onPress={() => onPressTeam(id)} />
      ))}
    </ScrollView>
  );
}

function FlagChip({
  teamId,
  index,
  onPress,
}: {
  teamId: string;
  index: number;
  onPress: () => void;
}) {
  const team = teamsById[teamId];
  const press = useSharedValue(0);

  const chipStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.12 }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    borderColor: press.value ? palette.gold : palette.border2,
    shadowOpacity: 0.18 + press.value * 0.5,
  }));

  return (
    <Animated.View entering={FadeInRight.delay(index * 70).springify().damping(15)}>
      <Pressable
        onPressIn={() => (press.value = withSpring(1, { mass: 0.4 }))}
        onPressOut={() => (press.value = withSpring(0, { mass: 0.4 }))}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={team?.name ?? teamId}>
        <Animated.View style={[styles.chip, chipStyle]}>
          <Animated.View style={[styles.flagCircle, ringStyle]}>
            {team?.iso2 ? (
              <Flag isoCode={team.iso2} size={CIRCLE} />
            ) : (
              <Text style={styles.emoji}>{team?.flag_emoji ?? '🏳️'}</Text>
            )}
          </Animated.View>
          <Text style={styles.code} numberOfLines={1}>
            {teamId.toUpperCase()}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Bleed past the screen's 20px content padding so it reads as a carousel.
  rail: { marginHorizontal: -20 },
  content: { paddingHorizontal: 20, gap: 16, paddingVertical: 2 },
  chip: { alignItems: 'center', gap: 7, width: CIRCLE + 8 },
  flagCircle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 2,
    borderColor: palette.border2,
    // Soft gold glow that intensifies on press.
    shadowColor: palette.gold,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
  },
  emoji: { fontSize: CIRCLE * 0.6 },
  code: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

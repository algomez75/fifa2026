import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { type TopScorer, useTopScorers } from '@/hooks/useTopScorers';
import { teamsById } from '@/lib/seed';
import { palette, radius } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';
import { Avatar } from './Avatar';
import { GlassCard } from './GlassCard';
import { TeamFlag } from './TeamFlag';

type T = ReturnType<typeof useTranslation>['t'];

/** Golden-boot leaderboard: rank · player avatar · name · flag · assists · goals.
 *  Columns are fixed-width so flags/assists/goals line up across every row.
 *  Tapping the card opens the full table in a draggable, scrollable sheet. */
export function TopScorersCard({ limit = 5 }: { limit?: number }) {
  const { t } = useTranslation();
  const { data } = useTopScorers();
  const all = data ?? [];
  const scorers = all.slice(0, limit);
  const [open, setOpen] = useState(false);
  if (!scorers.length) return null;

  return (
    <>
      <Pressable onPress={() => setOpen(true)}>
        <GlassCard accent={palette.gold}>
          <View style={{ gap: 12 }}>
            {scorers.map((s) => (
              <ScorerRow key={s.rank} s={s} t={t} />
            ))}
          </View>
        </GlassCard>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {open ? <ScorersSheet scorers={all} t={t} onClose={() => setOpen(false)} /> : null}
      </Modal>
    </>
  );
}

/** Bottom sheet: drag the header down (or fling sideways) to dismiss; the list
 *  itself scrolls independently. */
function ScorersSheet({
  scorers,
  t,
  onClose,
}: {
  scorers: TopScorer[];
  t: T;
  onClose: () => void;
}) {
  const { height, width } = Dimensions.get('window');
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      const dismissDown = e.translationY > 120 || e.velocityY > 900;
      const dismissSide = Math.abs(e.translationX) > 120 || Math.abs(e.velocityX) > 900;
      if (dismissDown) {
        translateY.value = withTiming(height, { duration: 220 }, () => runOnJS(onClose)());
      } else if (dismissSide) {
        const dir = e.translationX >= 0 ? 1 : -1;
        translateX.value = withTiming(dir * width, { duration: 220 }, () => runOnJS(onClose)());
      } else {
        translateY.value = withSpring(0, { damping: 18 });
        translateX.value = withSpring(0, { damping: 18 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { translateX: translateX.value }],
  }));

  return (
    <GestureHandlerRootView style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>
      <Animated.View style={[styles.sheet, sheetStyle]}>
        <GestureDetector gesture={pan}>
          <View style={styles.dragZone}>
            <View style={styles.handle} />
            <Text style={styles.title}>👟 {t.home.topScorers}</Text>
          </View>
        </GestureDetector>
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}>
          {scorers.map((s) => (
            <ScorerRow key={s.rank} s={s} t={t} />
          ))}
        </ScrollView>
        <Pressable style={styles.cancel} onPress={onClose}>
          <Text style={styles.cancelText}>{t.common.cancel}</Text>
        </Pressable>
      </Animated.View>
    </GestureHandlerRootView>
  );
}

function ScorerRow({ s, t }: { s: TopScorer; t: T }) {
  const team = s.team_id ? teamsById[s.team_id] : undefined;
  return (
    <View style={styles.row}>
      <Text style={[styles.rank, s.rank === 1 && styles.rankGold]}>{s.rank}</Text>
      <Avatar url={s.player_photo} name={s.player_name} size={30} ring={s.rank === 1} />
      <Text style={styles.name} numberOfLines={1}>
        {s.player_name}
      </Text>
      <View style={styles.flagCol}>
        <TeamFlag team={team} size={18} showName={false} />
      </View>
      <Text style={styles.assists}>
        {s.assists ?? 0}
        <Text style={styles.assistsLabel}> {t.home.assistsShort}</Text>
      </Text>
      <Text style={styles.goals}>
        {s.goals}
        <Text style={styles.goalsLabel}> {t.home.goalsShort}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: {
    color: palette.textTertiary,
    fontSize: 13,
    fontWeight: '900',
    width: 18,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  rankGold: { color: palette.gold },
  name: { color: palette.text, fontSize: 14, fontWeight: '700', flex: 1 },
  flagCol: { width: 24, alignItems: 'center' },
  assists: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 38,
    textAlign: 'right',
  },
  assistsLabel: { color: palette.textTertiary, fontSize: 10, fontWeight: '700' },
  goals: {
    color: palette.gold,
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    minWidth: 40,
    textAlign: 'right',
  },
  goalsLabel: { color: palette.textTertiary, fontSize: 11, fontWeight: '700' },
  // Modal sheet
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.border2,
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  dragZone: { paddingTop: 12, paddingBottom: 14, alignItems: 'center', gap: 12 },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border2,
  },
  title: { color: palette.gold, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  list: { flexShrink: 1 },
  listContent: { gap: 12, paddingBottom: 4 },
  cancel: { alignItems: 'center', paddingTop: 16 },
  cancelText: { color: palette.textSecondary, fontSize: 14, fontWeight: '700' },
});

import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { type TopScorer, useTopScorers } from '@/hooks/useTopScorers';
import { teamsById } from '@/lib/seed';
import { palette, radius } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';
import { Avatar } from './Avatar';
import { GlassCard } from './GlassCard';
import { TeamFlag } from './TeamFlag';

/** Golden-boot leaderboard: rank · player avatar · name · flag · assists · goals.
 *  Columns are fixed-width so flags/assists/goals line up across every row.
 *  Tapping the card opens the full table in a modal. */
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
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.title}>👟 {t.home.topScorers}</Text>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {all.map((s) => (
                <ScorerRow key={s.rank} s={s} t={t} />
              ))}
            </ScrollView>
            <Pressable style={styles.cancel} onPress={() => setOpen(false)}>
              <Text style={styles.cancelText}>{t.common.cancel}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function ScorerRow({ s, t }: { s: TopScorer; t: ReturnType<typeof useTranslation>['t'] }) {
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
  // Modal
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.border2,
    padding: 24,
    paddingBottom: 40,
    gap: 14,
    maxHeight: '75%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border2,
    marginBottom: 2,
  },
  title: { color: palette.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  cancel: { alignItems: 'center', paddingVertical: 4 },
  cancelText: { color: palette.textSecondary, fontSize: 14, fontWeight: '700' },
});

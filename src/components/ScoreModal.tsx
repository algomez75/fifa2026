import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Match } from '@/lib/database.types';
import { sideName } from '@/lib/format';
import { palette, radius } from '@/lib/theme';
import { teamsById } from '@/lib/seed';
import { TeamFlag } from '@/components/TeamFlag';
import { useUpdateScore } from '@/hooks/useMatches';
import { useTranslation } from '@/store/useAppStore';

interface Props {
  match: Match | null;
  onClose: () => void;
}

/** Manual score-entry sheet with +/- steppers and haptic confirm. */
export function ScoreModal({ match, onClose }: Props) {
  const { t, language } = useTranslation();
  const update = useUpdateScore();
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);

  useEffect(() => {
    if (match) {
      setHome(match.home_score ?? 0);
      setAway(match.away_score ?? 0);
    }
  }, [match]);

  if (!match) return null;

  const homeTeam = match.home_team_id ? teamsById[match.home_team_id] : undefined;
  const awayTeam = match.away_team_id ? teamsById[match.away_team_id] : undefined;

  const step = (setter: (n: number) => void, value: number, delta: number) => {
    const next = Math.max(0, Math.min(20, value + delta));
    if (next !== value) Haptics.selectionAsync();
    setter(next);
  };

  const confirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    update.mutate(
      { id: match.id, home_score: home, away_score: away, status: 'finished' },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t.schedule.enterScore}</Text>

          <View style={styles.row}>
            <Stepper
              name={sideName(match.home_team_id, match.home_placeholder, language)}
              team={homeTeam}
              value={home}
              onInc={() => step(setHome, home, 1)}
              onDec={() => step(setHome, home, -1)}
            />
            <Text style={styles.colon}>:</Text>
            <Stepper
              name={sideName(match.away_team_id, match.away_placeholder, language)}
              team={awayTeam}
              value={away}
              onInc={() => step(setAway, away, 1)}
              onDec={() => step(setAway, away, -1)}
            />
          </View>

          <Pressable
            style={styles.confirm}
            onPress={confirm}
            disabled={update.isPending}>
            <Text style={styles.confirmText}>
              {update.isPending ? '…' : t.schedule.markFinished}
            </Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>{t.common.cancel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Stepper({
  name,
  team,
  value,
  onInc,
  onDec,
}: {
  name: string;
  team?: import('@/lib/database.types').Team;
  value: number;
  onInc: () => void;
  onDec: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <TeamFlag team={team} size={30} showName={false} />
      <Text style={styles.stepperName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.stepValue}>{value}</Text>
      <View style={styles.stepBtns}>
        <Pressable style={styles.stepBtn} onPress={onDec} hitSlop={6}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Pressable style={styles.stepBtn} onPress={onInc} hitSlop={6}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.border2,
    padding: 24,
    paddingBottom: 40,
    gap: 18,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.border2,
    marginBottom: 4,
  },
  title: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  colon: { color: palette.textTertiary, fontSize: 34, fontWeight: '900', marginTop: 40 },
  stepper: { flex: 1, alignItems: 'center', gap: 8 },
  stepperName: { color: palette.textSecondary, fontSize: 13, fontWeight: '700', maxWidth: 120 },
  stepValue: {
    color: palette.gold,
    fontSize: 52,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  stepBtns: { flexDirection: 'row', gap: 12 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.card,
    borderColor: palette.border2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: palette.text, fontSize: 24, fontWeight: '800' },
  confirm: {
    backgroundColor: palette.gold,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmText: { color: palette.bg, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  cancel: { alignItems: 'center', paddingVertical: 4 },
  cancelText: { color: palette.textSecondary, fontSize: 14, fontWeight: '700' },
});

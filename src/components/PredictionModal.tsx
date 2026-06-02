import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Match, Prediction } from '@/lib/database.types';
import { formatMatchDay, sideName } from '@/lib/format';
import { scorePrediction } from '@/lib/scoring';
import { teamsById } from '@/lib/seed';
import { palette, radius } from '@/lib/theme';
import { TeamFlag } from '@/components/TeamFlag';
import { useSetPrediction } from '@/hooks/usePredictions';
import { useTranslation } from '@/store/useAppStore';

interface Props {
  match: Match | null;
  prediction: Prediction | null;
  onClose: () => void;
}

/** Predict a match score before kickoff; after kickoff it's read-only and shows
 *  the result + points earned. */
export function PredictionModal({ match, prediction, onClose }: Props) {
  const { t, language } = useTranslation();
  const setPred = useSetPrediction();
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);

  useEffect(() => {
    setHome(prediction?.home_pred ?? 0);
    setAway(prediction?.away_pred ?? 0);
  }, [prediction, match]);

  if (!match) return null;

  const locked =
    new Date(match.kickoff_utc).getTime() <= Date.now() || match.status !== 'scheduled';
  const homeTeam = match.home_team_id ? teamsById[match.home_team_id] : undefined;
  const awayTeam = match.away_team_id ? teamsById[match.away_team_id] : undefined;
  const result = prediction ? scorePrediction(prediction, match) : null;

  const step = (setter: (n: number) => void, value: number, delta: number) => {
    const next = Math.max(0, Math.min(20, value + delta));
    if (next !== value) Haptics.selectionAsync();
    setter(next);
  };

  const save = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPred.mutate(
      { matchId: match.id, homePred: home, awayPred: away },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t.predict.title}</Text>
          <Text style={styles.day}>{formatMatchDay(match.kickoff_utc, language)}</Text>

          <View style={styles.row}>
            <Stepper
              name={sideName(match.home_team_id, match.home_placeholder, language)}
              team={homeTeam}
              value={locked ? prediction?.home_pred ?? 0 : home}
              locked={locked}
              onInc={() => step(setHome, home, 1)}
              onDec={() => step(setHome, home, -1)}
            />
            <Text style={styles.colon}>:</Text>
            <Stepper
              name={sideName(match.away_team_id, match.away_placeholder, language)}
              team={awayTeam}
              value={locked ? prediction?.away_pred ?? 0 : away}
              locked={locked}
              onInc={() => step(setAway, away, 1)}
              onDec={() => step(setAway, away, -1)}
            />
          </View>

          {/* Actual result + points (after match) */}
          {match.status === 'finished' ? (
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>{t.common.ft}</Text>
              <Text style={styles.resultScore}>
                {match.home_score} : {match.away_score}
              </Text>
              {result ? (
                <Text
                  style={[
                    styles.pointsPill,
                    result.outcome === 'exact' && styles.pillExact,
                    result.outcome === 'result' && styles.pillResult,
                    result.outcome === 'miss' && styles.pillMiss,
                  ]}>
                  {result.outcome === 'exact'
                    ? t.predict.exact
                    : result.outcome === 'result'
                      ? t.predict.result
                      : t.predict.miss}
                </Text>
              ) : null}
            </View>
          ) : null}

          {locked ? (
            <Text style={styles.locked}>{t.predict.locked}</Text>
          ) : (
            <>
              <Pressable
                style={[styles.save, setPred.isPending && { opacity: 0.6 }]}
                onPress={save}
                disabled={setPred.isPending}>
                <Text style={styles.saveText}>
                  {setPred.isPending ? '…' : t.predict.save}
                </Text>
              </Pressable>
              <Text style={styles.note}>{t.predict.signInToSave}</Text>
            </>
          )}
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
  locked,
  onInc,
  onDec,
}: {
  name: string;
  team?: import('@/lib/database.types').Team;
  value: number;
  locked: boolean;
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
      {!locked ? (
        <View style={styles.stepBtns}>
          <Pressable style={styles.stepBtn} onPress={onDec} hitSlop={6}>
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
          <Pressable style={styles.stepBtn} onPress={onInc} hitSlop={6}>
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
        </View>
      ) : null}
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
    gap: 14,
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
  day: { color: palette.textSecondary, fontSize: 13, textAlign: 'center', marginTop: -6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', marginTop: 6 },
  colon: { color: palette.textTertiary, fontSize: 34, fontWeight: '900', marginTop: 40 },
  stepper: { flex: 1, alignItems: 'center', gap: 8 },
  stepperName: { color: palette.textSecondary, fontSize: 13, fontWeight: '700', maxWidth: 120 },
  stepValue: { color: palette.gold, fontSize: 52, fontWeight: '900', fontVariant: ['tabular-nums'] },
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
  resultBox: { alignItems: 'center', gap: 4, paddingVertical: 4 },
  resultLabel: { color: palette.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  resultScore: { color: palette.text, fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  pointsPill: {
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    fontSize: 13,
    fontWeight: '800',
    overflow: 'hidden',
  },
  pillExact: { backgroundColor: palette.goldDim, color: palette.gold },
  pillResult: { backgroundColor: 'rgba(99,153,34,0.15)', color: palette.success },
  pillMiss: { backgroundColor: palette.surface, color: palette.textSecondary },
  locked: { color: palette.textTertiary, fontSize: 13, textAlign: 'center', paddingVertical: 6 },
  save: {
    backgroundColor: palette.gold,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveText: { color: palette.bg, fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  note: { color: palette.textTertiary, fontSize: 12, textAlign: 'center' },
  cancel: { alignItems: 'center', paddingVertical: 4 },
  cancelText: { color: palette.textSecondary, fontSize: 14, fontWeight: '700' },
});

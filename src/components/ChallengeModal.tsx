import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChallengeSide, Match } from '@/lib/database.types';
import { formatMatchDay, teamName } from '@/lib/format';
import type { Language } from '@/lib/i18n';
import { teamsById } from '@/lib/seed';
import { palette, radius } from '@/lib/theme';
import { TeamFlag } from '@/components/TeamFlag';
import { useCreateChallenge, useRespondChallenge } from '@/hooks/useChallenges';
import { useTranslation } from '@/store/useAppStore';

export interface ChallengeTarget {
  match: Match;
  opponentName: string;
  mode: 'create' | 'accept';
  opponentId?: string;
  challengeId?: string;
  /** What the opponent predicted (only known for received challenges). */
  opponentSide?: ChallengeSide | null;
  opponentMargin?: number | null;
}

export function ChallengeModal({
  target,
  onClose,
}: {
  target: ChallengeTarget | null;
  onClose: () => void;
}) {
  const { t, language } = useTranslation();
  const create = useCreateChallenge();
  const respond = useRespondChallenge();
  const [side, setSide] = useState<ChallengeSide>('home');
  const [margin, setMargin] = useState(1);
  // For an incoming challenge: show what it is first ('detail'), then the pick.
  const [step, setStep] = useState<'detail' | 'pick'>('pick');

  useEffect(() => {
    setSide('home');
    setMargin(1);
    setStep(target?.mode === 'accept' ? 'detail' : 'pick');
  }, [target]);

  if (!target) return null;
  const { match } = target;
  const home = match.home_team_id ? teamsById[match.home_team_id] : undefined;
  const away = match.away_team_id ? teamsById[match.away_team_id] : undefined;
  const busy = create.isPending || respond.isPending;

  const sides: { key: ChallengeSide; label: string }[] = [
    { key: 'home', label: teamName(home, language) },
    { key: 'draw', label: t.challenge.draw },
    { key: 'away', label: teamName(away, language) },
  ];

  const step$ = (d: number) => {
    const next = Math.max(1, Math.min(10, margin + d));
    if (next !== margin) Haptics.selectionAsync();
    setMargin(next);
  };

  const declineNow = () => {
    if (!target.challengeId) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    respond.mutate({ id: target.challengeId, accept: false }, { onSuccess: onClose });
  };

  const submit = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const m = side === 'draw' ? 0 : margin;
    if (target.mode === 'create' && target.opponentId) {
      create.mutate(
        { matchId: match.id, opponentId: target.opponentId, side, margin: m },
        { onSuccess: onClose },
      );
    } else if (target.mode === 'accept' && target.challengeId) {
      respond.mutate(
        { id: target.challengeId, accept: true, side, margin: m },
        { onSuccess: onClose },
      );
    }
  };

  const teamsRow = (
    <View style={styles.teams}>
      <TeamFlag team={home} size={26} />
      <Text style={styles.day}>{formatMatchDay(match.kickoff_utc, language)}</Text>
      <TeamFlag team={away} size={26} reverse />
    </View>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          {step === 'detail' ? (
            // ── Phase 1: show what the challenge is, then ask accept / decline ──
            <>
              <Text style={styles.title}>
                <Text style={styles.actor}>{target.opponentName}</Text> {t.challenge.challengedYou}
              </Text>
              {teamsRow}

              {target.opponentSide ? (
                <View style={styles.theirCard}>
                  <Text style={styles.theirLabel}>{t.challenge.theyPicked}</Text>
                  <Text style={styles.theirValue}>
                    {predictionLabel(target.opponentSide, target.opponentMargin ?? null, match, t, language)}
                  </Text>
                </View>
              ) : null}

              <Text style={styles.question}>{t.challenge.acceptQuestion}</Text>

              <Pressable
                style={[styles.send, busy && { opacity: 0.6 }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setStep('pick');
                }}
                disabled={busy}>
                <Text style={styles.sendText}>{t.challenge.accept}</Text>
              </Pressable>
              <Pressable
                style={[styles.declineBtn, busy && { opacity: 0.6 }]}
                onPress={declineNow}
                disabled={busy}>
                <Text style={styles.declineText}>{busy ? '…' : t.challenge.decline}</Text>
              </Pressable>
              <Text style={styles.locked}>{t.challenge.locked}</Text>
            </>
          ) : (
            // ── Phase 2: make / confirm your own pick ──
            <>
              {target.mode === 'accept' ? (
                <Pressable style={styles.back} onPress={() => setStep('detail')} hitSlop={8}>
                  <Text style={styles.backText}>‹ {t.common.cancel}</Text>
                </Pressable>
              ) : null}
              <Text style={styles.title}>
                {target.mode === 'accept'
                  ? t.challenge.acceptTitle
                  : `${t.challenge.cta} · ${target.opponentName}`}
              </Text>
              <Text style={styles.pickTitle}>{t.challenge.pickTitle}</Text>

              {teamsRow}

              {/* side selector */}
              <View style={styles.sideRow}>
                {sides.map((s) => (
                  <Pressable
                    key={s.key}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSide(s.key);
                    }}
                    style={[styles.sideBtn, side === s.key && styles.sideBtnActive]}>
                    <Text
                      numberOfLines={1}
                      style={[styles.sideText, side === s.key && styles.sideTextActive]}>
                      {s.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* margin stepper (hidden for draw) */}
              {side !== 'draw' ? (
                <View style={styles.marginRow}>
                  <Text style={styles.marginLabel}>{t.challenge.margin}</Text>
                  <View style={styles.stepBtns}>
                    <Pressable style={styles.stepBtn} onPress={() => step$(-1)} hitSlop={6}>
                      <Text style={styles.stepBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.marginValue}>{margin}</Text>
                    <Pressable style={styles.stepBtn} onPress={() => step$(1)} hitSlop={6}>
                      <Text style={styles.stepBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <Pressable
                style={[styles.send, busy && { opacity: 0.6 }]}
                onPress={submit}
                disabled={busy}>
                <Text style={styles.sendText}>
                  {busy ? '…' : target.mode === 'accept' ? t.challenge.accept : t.challenge.send}
                </Text>
              </Pressable>
              <Text style={styles.locked}>{t.challenge.locked}</Text>
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

/** "Brazil by 2" / "Draw" — a readable summary of a side + margin pick. */
function predictionLabel(
  side: ChallengeSide,
  margin: number | null,
  match: Match,
  t: ReturnType<typeof useTranslation>['t'],
  lang: Language,
): string {
  if (side === 'draw') return t.challenge.draw;
  const team =
    side === 'home'
      ? match.home_team_id && teamsById[match.home_team_id]
      : match.away_team_id && teamsById[match.away_team_id];
  const name = team ? teamName(team, lang) : side;
  return `${name} ${t.challenge.byGoals} ${margin ?? 0}`;
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
  back: { alignSelf: 'flex-start', marginBottom: -6 },
  backText: { color: palette.textSecondary, fontSize: 14, fontWeight: '700' },
  title: { color: palette.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  actor: { color: palette.gold, fontWeight: '900' },
  pickTitle: { color: palette.textSecondary, fontSize: 14, textAlign: 'center', marginTop: -6 },
  question: { color: palette.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  teams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  day: { color: palette.gold, fontSize: 12, fontWeight: '700' },
  theirCard: {
    backgroundColor: palette.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    gap: 4,
    alignItems: 'center',
  },
  theirLabel: { color: palette.textSecondary, fontSize: 12, fontWeight: '700' },
  theirValue: { color: palette.text, fontSize: 16, fontWeight: '800' },
  sideRow: { flexDirection: 'row', gap: 8 },
  sideBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  sideBtnActive: { backgroundColor: palette.goldDim, borderColor: palette.gold },
  sideText: { color: palette.textSecondary, fontSize: 13, fontWeight: '700' },
  sideTextActive: { color: palette.gold },
  marginRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  marginLabel: { color: palette.text, fontSize: 14, fontWeight: '600' },
  stepBtns: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.card,
    borderColor: palette.border2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: palette.text, fontSize: 22, fontWeight: '800' },
  marginValue: {
    color: palette.gold,
    fontSize: 28,
    fontWeight: '900',
    minWidth: 30,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  send: {
    backgroundColor: palette.gold,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  sendText: { color: palette.bg, fontSize: 16, fontWeight: '900' },
  declineBtn: {
    borderColor: palette.border2,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  declineText: { color: palette.textSecondary, fontSize: 15, fontWeight: '800' },
  locked: { color: palette.textTertiary, fontSize: 12, textAlign: 'center' },
  cancel: { alignItems: 'center', paddingVertical: 4 },
  cancelText: { color: palette.textSecondary, fontSize: 14, fontWeight: '700' },
});

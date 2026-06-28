import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { ChallengeModal, type ChallengeTarget } from '@/components/ChallengeModal';
import { MatchCard } from '@/components/MatchCard';
import { EmptyState, LoadingState } from '@/components/States';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import type { Match, MyChallengeRow, NotificationRow } from '@/lib/database.types';
import { palette, radius } from '@/lib/theme';
import { useChallenges } from '@/hooks/useChallenges';
import { useInbox, useMarkRead } from '@/hooks/useInbox';
import { useMatches } from '@/hooks/useMatches';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { useResolveMatch } from '@/hooks/useResolveMatch';
import { useTranslation } from '@/store/useAppStore';

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: notifs, isLoading } = useInbox();
  const { data: challenges } = useChallenges();
  const markRead = useMarkRead();
  const { data: matches } = useMatches();
  const { requireAccount } = useRequireAccount();
  const resolve = useResolveMatch();
  const [accept, setAccept] = useState<ChallengeTarget | null>(null);

  const matchesById = useMemo(() => {
    const map: Record<string, Match> = {};
    for (const m of matches ?? []) map[m.id] = m;
    return map;
  }, [matches]);

  const challengesById = useMemo(() => {
    const map: Record<string, MyChallengeRow> = {};
    for (const c of challenges ?? []) map[c.id] = c;
    return map;
  }, [challenges]);

  // mark everything read on open
  useEffect(() => {
    markRead.mutate(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const labelFor = (n: NotificationRow) =>
    n.type === 'challenge_received'
      ? t.challenge.challengedYou
      : n.type === 'challenge_accepted'
        ? t.notif.accepted
        : n.type === 'challenge_declined'
          ? t.notif.declined
          : n.type;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={palette.text} size={22} />
        </Pressable>
        <Text style={styles.title}>{t.notif.title}</Text>
        <Pressable onPress={() => router.push('/challenges')}>
          <Text style={styles.link}>⚔️ {t.challenge.myChallenges}</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <LoadingState />
      ) : !notifs || notifs.length === 0 ? (
        <EmptyState emoji="🔔" subtitle={t.notif.empty} />
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const match = item.match_id ? matchesById[item.match_id] : undefined;
            const challenge = item.challenge_id ? challengesById[item.challenge_id] : undefined;
            // A received challenge is actionable only while it's still pending
            // and the match hasn't kicked off.
            const canRespond =
              item.type === 'challenge_received' &&
              !!match &&
              !!item.challenge_id &&
              (!challenge || challenge.status === 'pending') &&
              new Date(match.kickoff_utc).getTime() > Date.now();

            const open = () => {
              if (!canRespond || !match) return;
              if (!requireAccount()) return;
              setAccept({
                match,
                mode: 'accept',
                challengeId: item.challenge_id!,
                opponentName: item.actor_name ?? 'Player',
                // their pick comes from get_my_challenges (their_* = challenger)
                opponentSide: challenge?.their_side ?? null,
                opponentMargin: challenge?.their_margin ?? null,
              });
            };

            const resolved = match ? resolve(match) : undefined;

            return (
              <Pressable
                onPress={open}
                disabled={!canRespond}
                style={[styles.row, !item.read && styles.rowUnread]}>
                <View style={styles.notifTop}>
                  <Avatar name={item.actor_name} size={36} ring={false} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.text}>
                      <Text style={styles.actor}>{item.actor_name}</Text> {labelFor(item)}
                    </Text>
                    {canRespond ? (
                      <Text style={styles.hint}>{t.challenge.acceptQuestion}</Text>
                    ) : null}
                  </View>
                  {canRespond ? <ChevronRightIcon color={palette.textTertiary} size={18} /> : null}
                </View>
                {/* Full match info: real flags + names (R32 resolved), date, score */}
                {resolved ? (
                  <MatchCard
                    match={resolved.match}
                    qualMark={{ home: resolved.home, away: resolved.away }}
                    onPress={canRespond ? () => open() : undefined}
                  />
                ) : null}
              </Pressable>
            );
          }}
        />
      )}

      <ChallengeModal target={accept} onClose={() => setAccept(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: palette.text, fontSize: 20, fontWeight: '900', flex: 1 },
  link: { color: palette.gold, fontSize: 13, fontWeight: '800' },
  list: { paddingHorizontal: 20, paddingBottom: 60, gap: 8 },
  row: {
    gap: 10,
    backgroundColor: palette.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 12,
  },
  notifTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowUnread: { borderColor: palette.gold, backgroundColor: palette.cardElevated },
  text: { color: palette.text, fontSize: 14, lineHeight: 19 },
  actor: { fontWeight: '800' },
  hint: { color: palette.gold, fontSize: 12, fontWeight: '700' },
});

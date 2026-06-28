import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { ChallengeModal, type ChallengeTarget } from '@/components/ChallengeModal';
import { MatchCard } from '@/components/MatchCard';
import { EmptyState, LoadingState } from '@/components/States';
import { ChevronLeftIcon } from '@/components/icons';
import type { Match, Prediction, UserPredictionRow } from '@/lib/database.types';
import { palette, radius } from '@/lib/theme';
import { useMatches } from '@/hooks/useMatches';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { useUserPredictions } from '@/hooks/useUserPredictions';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/store/useAppStore';

export default function UserPredictionsScreen() {
  const { id, name, avatar, points, rank } = useLocalSearchParams<{
    id: string;
    name?: string;
    avatar?: string;
    points?: string;
    rank?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language } = useTranslation();
  const es = language === 'es';

  const { data: rows, isLoading } = useUserPredictions(id);
  const { data: matches } = useMatches();
  const myId = useAuthStore((s) => s.user?.id);
  const { requireAccount } = useRequireAccount();
  const [challenge, setChallenge] = useState<ChallengeTarget | null>(null);
  const [picking, setPicking] = useState(false);
  const isSelf = myId === id;

  const matchesById = useMemo(() => {
    const map: Record<string, Match> = {};
    for (const m of matches ?? []) map[m.id] = m;
    return map;
  }, [matches]);

  // Upcoming matches you can challenge this player on (any scheduled fixture;
  // creating a challenge after kickoff is RLS-blocked anyway).
  const upcomingMatches = useMemo(
    () =>
      (matches ?? [])
        .filter((m) => m.status === 'scheduled')
        .sort((a, b) => new Date(a.kickoff_utc).getTime() - new Date(b.kickoff_utc).getTime()),
    [matches],
  );

  const openChallenge = (m: Match) => {
    if (!requireAccount()) return;
    setPicking(false);
    setChallenge({ match: m, mode: 'create', opponentId: id, opponentName: name || 'Player' });
  };

  // Only live + already-played events here (upcoming/scheduled picks are hidden
  // — they're locked/blank anyway). Same timeline order: the in-play match on
  // top, then finished ones below (most recent first).
  const sortedRows = useMemo(() => {
    const rank = (s: UserPredictionRow['status']) => (s === 'live' ? 0 : 2);
    return [...(rows ?? [])]
      .filter((r) => r.status !== 'scheduled')
      .sort((a, b) => {
        const ra = rank(a.status);
        const rb = rank(b.status);
        if (ra !== rb) return ra - rb;
        const ta = new Date(a.kickoff_utc).getTime();
        const tb = new Date(b.kickoff_utc).getTime();
        // live: soonest first; finished: most recent first.
        return ra === 2 ? tb - ta : ta - tb;
      });
  }, [rows]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon color={palette.text} size={22} />
        </Pressable>
        <Avatar url={avatar || null} name={name} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {name || 'Player'}
          </Text>
          <Text style={styles.meta}>
            {rank ? `#${rank} · ` : ''}
            {points ?? 0} {t.leaderboard.pts}
          </Text>
        </View>
        {!isSelf ? (
          <Pressable style={styles.retarBtn} onPress={() => setPicking(true)} hitSlop={6}>
            <Text style={styles.retarBtnText}>⚔️ {t.challenge.cta}</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>{t.leaderboard.predictionsBy}</Text>

      {isLoading ? (
        <LoadingState />
      ) : sortedRows.length === 0 ? (
        <EmptyState emoji="🎯" subtitle={t.leaderboard.noPredictions} />
      ) : (
        <FlatList
          data={sortedRows}
          keyExtractor={(r) => r.match_id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <PredItem
              row={item}
              match={matchesById[item.match_id]}
              hiddenLabel={t.leaderboard.hiddenPick}
              userId={id}
            />
          )}
        />
      )}

      {/* Pick an upcoming match to challenge this player on */}
      <Modal
        visible={picking}
        animationType="slide"
        transparent
        onRequestClose={() => setPicking(false)}>
        <View style={styles.pickerScreen}>
          <View style={[styles.pickerHeader, { paddingTop: insets.top + 10 }]}>
            <Text style={styles.pickerTitle} numberOfLines={1}>
              ⚔️ {es ? 'Reta a' : 'Challenge'} {name || 'Player'}
            </Text>
            <Pressable style={styles.backBtn} onPress={() => setPicking(false)} hitSlop={8}>
              <Text style={styles.pickerClose}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.pickerSub}>
            {es ? 'Elige un próximo partido' : 'Pick an upcoming match'}
          </Text>
          {upcomingMatches.length === 0 ? (
            <EmptyState emoji="📅" subtitle={es ? 'No hay próximos partidos' : 'No upcoming matches'} />
          ) : (
            <FlatList
              data={upcomingMatches}
              keyExtractor={(m) => m.id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => <MatchCard match={item} onPress={openChallenge} />}
            />
          )}
        </View>
      </Modal>

      <ChallengeModal target={challenge} onClose={() => setChallenge(null)} />
    </View>
  );
}

function PredItem({
  row,
  match,
  hiddenLabel,
  userId,
}: {
  row: UserPredictionRow;
  match?: Match;
  hiddenLabel: string;
  userId: string;
}) {
  if (!match) return null;
  const prediction: Prediction | null =
    row.revealed && row.home_pred != null && row.away_pred != null
      ? { user_id: userId, match_id: row.match_id, home_pred: row.home_pred, away_pred: row.away_pred }
      : null;

  return (
    <View style={{ gap: 4 }}>
      <MatchCard match={match} prediction={prediction} />
      {!row.revealed ? <Text style={styles.hidden}>🔒 {hiddenLabel}</Text> : null}
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
  name: { color: palette.text, fontSize: 20, fontWeight: '900' },
  meta: { color: palette.gold, fontSize: 13, fontWeight: '700', marginTop: 2 },
  retarBtn: {
    backgroundColor: palette.goldDim,
    borderColor: palette.gold,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retarBtnText: { color: palette.gold, fontSize: 13, fontWeight: '800' },
  sectionTitle: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  list: { paddingHorizontal: 20, paddingBottom: 60, gap: 10 },
  hidden: {
    color: palette.textTertiary,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 4,
  },
  pickerScreen: { flex: 1, backgroundColor: palette.bg },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  pickerTitle: { color: palette.text, fontSize: 18, fontWeight: '900', flex: 1 },
  pickerClose: { color: palette.text, fontSize: 18, fontWeight: '800' },
  pickerSub: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
});

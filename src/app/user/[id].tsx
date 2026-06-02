import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const { t } = useTranslation();

  const { data: rows, isLoading } = useUserPredictions(id);
  const { data: matches } = useMatches();
  const myId = useAuthStore((s) => s.user?.id);
  const { requireAccount } = useRequireAccount();
  const [challenge, setChallenge] = useState<ChallengeTarget | null>(null);
  const isSelf = myId === id;

  const matchesById = useMemo(() => {
    const map: Record<string, Match> = {};
    for (const m of matches ?? []) map[m.id] = m;
    return map;
  }, [matches]);

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
      </View>

      <Text style={styles.sectionTitle}>{t.leaderboard.predictionsBy}</Text>

      {isLoading ? (
        <LoadingState />
      ) : !rows || rows.length === 0 ? (
        <EmptyState emoji="🎯" subtitle={t.leaderboard.noPredictions} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.match_id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <PredItem
              row={item}
              match={matchesById[item.match_id]}
              hiddenLabel={t.leaderboard.hiddenPick}
              userId={id}
              canChallenge={!isSelf}
              challengeLabel={t.challenge.cta}
              onChallenge={(m) => {
                if (!requireAccount()) return;
                setChallenge({
                  match: m,
                  mode: 'create',
                  opponentId: id,
                  opponentName: name || 'Player',
                });
              }}
            />
          )}
        />
      )}

      <ChallengeModal target={challenge} onClose={() => setChallenge(null)} />
    </View>
  );
}

function PredItem({
  row,
  match,
  hiddenLabel,
  userId,
  canChallenge,
  challengeLabel,
  onChallenge,
}: {
  row: UserPredictionRow;
  match?: Match;
  hiddenLabel: string;
  userId: string;
  canChallenge: boolean;
  challengeLabel: string;
  onChallenge: (m: Match) => void;
}) {
  if (!match) return null;
  const prediction: Prediction | null =
    row.revealed && row.home_pred != null && row.away_pred != null
      ? { user_id: userId, match_id: row.match_id, home_pred: row.home_pred, away_pred: row.away_pred }
      : null;
  const upcoming = new Date(row.kickoff_utc).getTime() > Date.now() && row.status === 'scheduled';

  return (
    <View style={{ gap: 4 }}>
      <MatchCard match={match} prediction={prediction} />
      {!row.revealed ? <Text style={styles.hidden}>🔒 {hiddenLabel}</Text> : null}
      {canChallenge && upcoming ? (
        <Pressable style={styles.challengeBtn} onPress={() => onChallenge(match)}>
          <Text style={styles.challengeText}>⚔️ {challengeLabel}</Text>
        </Pressable>
      ) : null}
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
  challengeBtn: {
    alignSelf: 'flex-start',
    backgroundColor: palette.goldDim,
    borderColor: palette.gold,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 2,
  },
  challengeText: { color: palette.gold, fontSize: 13, fontWeight: '800' },
});

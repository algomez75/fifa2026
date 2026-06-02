import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { ChallengeModal, type ChallengeTarget } from '@/components/ChallengeModal';
import { EmptyState, LoadingState } from '@/components/States';
import { ChevronLeftIcon } from '@/components/icons';
import type { ChallengeSide, Match, MyChallengeRow } from '@/lib/database.types';
import { formatMatchDay, teamName } from '@/lib/format';
import type { Language } from '@/lib/i18n';
import { teamsById } from '@/lib/seed';
import { palette, radius } from '@/lib/theme';
import { useChallenges, useRespondChallenge } from '@/hooks/useChallenges';
import { useMatches } from '@/hooks/useMatches';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { useTranslation } from '@/store/useAppStore';

export default function ChallengesScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: rows, isLoading } = useChallenges();
  const respond = useRespondChallenge();
  const { data: matches } = useMatches();
  const { requireAccount } = useRequireAccount();
  const [accept, setAccept] = useState<ChallengeTarget | null>(null);

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
        <Text style={styles.title}>⚔️ {t.challenge.myChallenges}</Text>
      </View>

      {isLoading ? (
        <LoadingState />
      ) : !rows || rows.length === 0 ? (
        <EmptyState emoji="⚔️" subtitle={t.challenge.empty} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ChallengeRow
              row={item}
              match={matchesById[item.match_id]}
              language={language}
              t={t}
              onAccept={() => {
                if (!requireAccount()) return;
                setAccept({
                  match: matchesById[item.match_id],
                  mode: 'accept',
                  challengeId: item.id,
                  opponentName: item.other_name,
                  opponentSide: item.their_side,
                  opponentMargin: item.their_margin,
                });
              }}
              onDecline={() => respond.mutate({ id: item.id, accept: false })}
            />
          )}
        />
      )}

      <ChallengeModal target={accept} onClose={() => setAccept(null)} />
    </View>
  );
}

function pickLabel(
  side: ChallengeSide | null,
  margin: number | null,
  match: Match | undefined,
  t: ReturnType<typeof useTranslation>['t'],
  lang: Language,
): string {
  if (!side) return '—';
  if (side === 'draw') return t.challenge.draw;
  const team = match
    ? side === 'home'
      ? match.home_team_id && teamsById[match.home_team_id]
      : match.away_team_id && teamsById[match.away_team_id]
    : undefined;
  const name = team ? teamName(team, lang) : side;
  return `${name} ${t.challenge.byGoals} ${margin ?? 0}`;
}

function ChallengeRow({
  row,
  match,
  language,
  t,
  onAccept,
  onDecline,
}: {
  row: MyChallengeRow;
  match?: Match;
  language: Language;
  t: ReturnType<typeof useTranslation>['t'];
  onAccept: () => void;
  onDecline: () => void;
}) {
  const isPendingReceived = row.status === 'pending' && row.role === 'opponent';
  const isPendingSent = row.status === 'pending' && row.role === 'challenger';

  let badge: { label: string; color: string } | null = null;
  if (row.status === 'declined') badge = { label: t.challenge.declined, color: palette.textTertiary };
  else if (row.outcome === 'won') badge = { label: `${t.challenge.won} +3`, color: palette.gold };
  else if (row.outcome === 'lost') badge = { label: t.challenge.lost, color: palette.textTertiary };
  else if (row.outcome === 'tie') badge = { label: `${t.challenge.tie} +1`, color: palette.success };
  else if (row.status === 'accepted') badge = { label: t.challenge.accepted, color: palette.success };
  else if (isPendingSent) badge = { label: t.challenge.waiting, color: palette.textSecondary };

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Avatar url={row.other_avatar} name={row.other_name} size={32} ring={false} />
        <Text style={styles.opponent} numberOfLines={1}>
          {row.other_name}
        </Text>
        {badge ? (
          <Text style={[styles.badge, { color: badge.color, borderColor: badge.color }]}>
            {badge.label}
          </Text>
        ) : null}
      </View>

      <Text style={styles.matchLine}>
        {match
          ? `${teamName(match.home_team_id ? teamsById[match.home_team_id] : undefined, language)} – ${teamName(match.away_team_id ? teamsById[match.away_team_id] : undefined, language)}`
          : row.match_id}
        {'  ·  '}
        {formatMatchDay(row.kickoff_utc, language)}
      </Text>

      {row.status !== 'pending' || row.role === 'challenger' ? (
        <View style={styles.picks}>
          <Text style={styles.pick}>
            <Text style={styles.pickWho}>{t.challenge.yourPick}: </Text>
            {pickLabel(row.my_side, row.my_margin, match, t, language)}
          </Text>
          {row.their_side ? (
            <Text style={styles.pick}>
              <Text style={styles.pickWho}>{t.challenge.theirPick}: </Text>
              {pickLabel(row.their_side, row.their_margin, match, t, language)}
            </Text>
          ) : null}
        </View>
      ) : null}

      {isPendingReceived ? (
        <View style={styles.actions}>
          <Pressable style={styles.accept} onPress={onAccept}>
            <Text style={styles.acceptText}>{t.challenge.accept}</Text>
          </Pressable>
          <Pressable style={styles.decline} onPress={onDecline}>
            <Text style={styles.declineText}>{t.challenge.decline}</Text>
          </Pressable>
        </View>
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
  title: { color: palette.text, fontSize: 20, fontWeight: '900', flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 60, gap: 10 },
  card: {
    backgroundColor: palette.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  opponent: { color: palette.text, fontSize: 15, fontWeight: '800', flex: 1 },
  badge: {
    fontSize: 11,
    fontWeight: '800',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  matchLine: { color: palette.textSecondary, fontSize: 13 },
  picks: { gap: 3 },
  pick: { color: palette.text, fontSize: 13 },
  pickWho: { color: palette.textSecondary, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 2 },
  accept: {
    backgroundColor: palette.gold,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  acceptText: { color: palette.bg, fontSize: 13, fontWeight: '800' },
  decline: {
    borderColor: palette.border2,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  declineText: { color: palette.textSecondary, fontSize: 13, fontWeight: '700' },
});

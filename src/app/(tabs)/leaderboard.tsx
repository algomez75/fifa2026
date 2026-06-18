import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { GlassCard } from '@/components/GlassCard';
import { HeaderActions } from '@/components/HeaderActions';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { ShareIcon } from '@/components/icons';
import type { LeaderboardRow } from '@/lib/database.types';
import { palette, radius } from '@/lib/theme';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/store/useAppStore';

/** Public App Store listing — keep in sync with landing/script.js. */
const APP_STORE_URL = 'https://apps.apple.com/app/11-gol/id6775887761';

export default function LeaderboardScreen() {
  const { t, language } = useTranslation();
  const { data: rows, isLoading, isError, isFetching, refetch } = useLeaderboard();
  const userId = useAuthStore((s) => s.user?.id);

  // Refresh the ranking whenever the tab regains focus.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const me = useMemo(() => {
    if (!rows || !userId) return null;
    const idx = rows.findIndex((r) => r.user_id === userId);
    return idx >= 0 ? { row: rows[idx], rank: idx + 1 } : null;
  }, [rows, userId]);

  // Share your personal ranking via the device's native share sheet.
  const shareRanking = useCallback(async () => {
    if (!me) return;
    const total = rows?.length ?? 0;
    const message =
      language === 'es'
        ? `🏆 Voy #${me.rank}${total ? ` de ${total}` : ''} en 11 Gol con ${me.row.points} pts prediciendo el Mundial 2026. ¿Puedes superarme? ⚽\n\n${APP_STORE_URL}`
        : `🏆 I'm #${me.rank}${total ? ` of ${total}` : ''} on 11 Gol with ${me.row.points} pts predicting the 2026 World Cup. Can you beat me? ⚽\n\n${APP_STORE_URL}`;
    try {
      // URL lives inside `message` (not a separate `url`) so the link travels
      // with the text on every target and isn't duplicated on iOS.
      await Share.share(
        { message, title: t.leaderboard.shareTitle },
        { dialogTitle: t.leaderboard.shareTitle, subject: t.leaderboard.shareTitle },
      );
    } catch {
      // user dismissed the sheet — nothing to do
    }
  }, [me, rows, language, t.leaderboard.shareTitle]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow={t.leaderboard.eyebrow}
        title={t.leaderboard.title}
        right={<HeaderActions />}
      />

      {/* Your score card */}
      <View style={styles.meWrap}>
        <GlassCard accent={palette.gold}>
          <View style={styles.meRow}>
            <Text style={styles.meLabel}>{t.leaderboard.yourScore}</Text>
            {me ? (
              <View style={styles.meStats}>
                <Text style={styles.meRank}>#{me.rank}</Text>
                <Text style={styles.mePts}>
                  {me.row.points} <Text style={styles.mePtsUnit}>{t.leaderboard.pts}</Text>
                </Text>
                <Pressable
                  onPress={shareRanking}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t.leaderboard.share}
                  style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.6 }]}>
                  <ShareIcon color={palette.gold} size={17} strokeWidth={2.2} />
                </Pressable>
              </View>
            ) : (
              <Text style={styles.meEmpty}>{t.leaderboard.notRanked}</Text>
            )}
          </View>
        </GlassCard>
      </View>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : !rows || rows.length === 0 ? (
        <EmptyState emoji="🏆" subtitle={t.leaderboard.empty} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.user_id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={palette.gold}
            />
          }
          renderItem={({ item, index }) => (
            <Row row={item} rank={index + 1} isMe={item.user_id === userId} t={t} />
          )}
          ListFooterComponent={
            <Text style={styles.reportHint}>{t.leaderboard.reportHint}</Text>
          }
        />
      )}
    </View>
  );
}

function Row({
  row,
  rank,
  isMe,
  t,
}: {
  row: LeaderboardRow;
  rank: number;
  isMe: boolean;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const router = useRouter();
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  const open = () =>
    router.push({
      pathname: '/user/[id]',
      params: {
        id: row.user_id,
        name: row.display_name,
        avatar: row.avatar_url ?? '',
        points: String(row.points),
        rank: String(rank),
      },
    });

  const report = () => {
    if (isMe) return;
    Alert.alert(t.leaderboard.report, t.leaderboard.reportBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.leaderboard.report,
        style: 'destructive',
        onPress: () => {
          const subject = encodeURIComponent(`11 Gol report: ${row.user_id}`);
          const body = encodeURIComponent(
            `Reporting player "${row.display_name}" (id ${row.user_id}) for inappropriate name/photo.`,
          );
          Linking.openURL(`mailto:info@portela11.com?subject=${subject}&body=${body}`);
        },
      },
    ]);
  };

  return (
    <Pressable
      onPress={open}
      onLongPress={report}
      delayLongPress={400}
      style={({ pressed }) => [styles.row, isMe && styles.rowMe, pressed && { opacity: 0.85 }]}>
      <View style={styles.rankCol}>
        {medal ? (
          <Text style={styles.medal}>{medal}</Text>
        ) : (
          <Text style={styles.rankNum}>{rank}</Text>
        )}
      </View>
      <Avatar url={row.avatar_url} name={row.display_name} size={38} ring={false} />
      <View style={styles.nameCol}>
        <Text style={styles.name} numberOfLines={1}>
          {row.display_name}
          {isMe ? <Text style={styles.youTag}> · {t.leaderboard.you}</Text> : null}
        </Text>
        <Text style={styles.sub}>
          {row.total} {t.leaderboard.made} · {row.exact} {t.leaderboard.exactShort}
        </Text>
      </View>
      <Text style={styles.points}>{row.points}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  meWrap: { paddingHorizontal: 20, marginBottom: 8 },
  meRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meLabel: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  meStats: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.32)',
  },
  meRank: { color: palette.text, fontSize: 20, fontWeight: '900' },
  mePts: { color: palette.gold, fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  mePtsUnit: { fontSize: 13, color: palette.textSecondary, fontWeight: '700' },
  meEmpty: { color: palette.textTertiary, fontSize: 13, flex: 1, textAlign: 'right' },
  list: { paddingHorizontal: 20, paddingBottom: 140, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowMe: { borderColor: palette.gold, backgroundColor: palette.cardElevated },
  rankCol: { width: 28, alignItems: 'center' },
  rankNum: { color: palette.textSecondary, fontSize: 15, fontWeight: '800' },
  medal: { fontSize: 18 },
  nameCol: { flex: 1, gap: 2 },
  name: { color: palette.text, fontSize: 15, fontWeight: '700' },
  youTag: { color: palette.gold, fontSize: 12, fontWeight: '800' },
  sub: { color: palette.textTertiary, fontSize: 11 },
  points: { color: palette.gold, fontSize: 20, fontWeight: '900', fontVariant: ['tabular-nums'] },
  reportHint: { color: palette.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 14 },
});

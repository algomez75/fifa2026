import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import CountryFlag from 'react-native-country-flag';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { GradientHeader } from '@/components/GradientHeader';
import { GroupTable } from '@/components/GroupTable';
import { MatchCard } from '@/components/MatchCard';
import { PredictionModal } from '@/components/PredictionModal';
import { EmptyState } from '@/components/States';
import { ChevronLeftIcon, HeartIcon } from '@/components/icons';
import type { Match, Player } from '@/lib/database.types';
import { teamName } from '@/lib/format';
import { seedTeams, teamsById } from '@/lib/seed';
import { confederationColor, palette, radius } from '@/lib/theme';
import { useFavorites } from '@/hooks/useFavorites';
import { useMatches } from '@/hooks/useMatches';
import { usePredictions } from '@/hooks/usePredictions';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { ageFromDob, useSquad } from '@/hooks/useSquad';
import { useTranslation } from '@/store/useAppStore';

export default function TeamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language } = useTranslation();
  const { favorites, toggleFavorite } = useFavorites();
  const { data: matches } = useMatches();
  const { data: squad } = useSquad(id);
  const { data: predictions } = usePredictions();
  const { requireAccount } = useRequireAccount();
  const [predicting, setPredicting] = useState<Match | null>(null);

  // Favorites/predictions need a real account; prompt guests to sign in.
  const onToggleFavorite = (teamId: string) => {
    if (requireAccount()) void toggleFavorite(teamId);
  };
  const openPrediction = (m: Match) => {
    const predictable =
      m.status === 'scheduled' && new Date(m.kickoff_utc).getTime() > Date.now();
    if (predictable && !requireAccount()) return;
    setPredicting(m);
  };

  // Back button always returns to the full Teams list (not the previous team).
  const goToTeams = () => {
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/teams');
  };

  const team = id ? teamsById[id] : undefined;

  const groupTeamIds = useMemo(
    () =>
      team
        ? seedTeams
            .filter((x) => x.group_letter === team.group_letter)
            .map((x) => x.id)
        : [],
    [team],
  );

  const teamMatches = useMemo(() => {
    if (!team) return { upcoming: [], past: [], group: [] };
    const mine = (matches ?? []).filter(
      (m) => m.home_team_id === team.id || m.away_team_id === team.id,
    );
    return {
      upcoming: mine
        .filter((m) => m.status !== 'finished')
        .sort(
          (a, b) =>
            new Date(a.kickoff_utc).getTime() - new Date(b.kickoff_utc).getTime(),
        ),
      past: mine.filter((m) => m.status === 'finished'),
      group: (matches ?? []).filter(
        (m) => m.stage === 'group' && m.group_letter === team.group_letter,
      ),
    };
  }, [team, matches]);

  if (!team) {
    return (
      <View style={styles.screen}>
        <EmptyState emoji="🔎" title="Team not found" />
      </View>
    );
  }

  const isFav = favorites.includes(team.id);
  const accent = team.confederation
    ? confederationColor[team.confederation] ?? palette.gold
    : palette.gold;

  return (
    <View style={styles.screen}>
      <GradientHeader color={accent} height={220 + insets.top}>
        <View style={[styles.headerInner, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerTop}>
            <Pressable style={styles.backBtn} onPress={goToTeams} hitSlop={8}>
              <ChevronLeftIcon color={palette.text} size={22} />
            </Pressable>
            <Pressable
              style={styles.favBtn}
              onPress={() => onToggleFavorite(team.id)}
              hitSlop={8}>
              <HeartIcon
                color={isFav ? palette.gold : palette.text}
                size={22}
                filled={isFav}
              />
            </Pressable>
          </View>

          <View style={styles.identity}>
            {team.iso2 ? (
              <View style={styles.flagShadow}>
                <CountryFlag isoCode={team.iso2} size={56} />
              </View>
            ) : (
              <Text style={{ fontSize: 52 }}>{team.flag_emoji}</Text>
            )}
            <Text style={styles.teamName}>{teamName(team, language)}</Text>
            <View style={styles.badges}>
              {team.host_country ? (
                <View style={[styles.badge, { borderColor: palette.gold }]}>
                  <Text style={[styles.badgeText, { color: palette.gold }]}>
                    {t.team.hostNation}
                  </Text>
                </View>
              ) : null}
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{team.confederation}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {t.groups.group} {team.group_letter}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </GradientHeader>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>{t.team.standing}</Text>
        <View style={{ marginBottom: 20 }}>
          <GroupTable
            groupLetter={team.group_letter ?? '?'}
            teamIds={groupTeamIds}
            matches={teamMatches.group}
          />
        </View>

        <Text style={styles.sectionTitle}>{t.team.matches}</Text>
        <View style={{ gap: 10 }}>
          {[...teamMatches.upcoming, ...teamMatches.past].map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              prediction={predictions?.[m.id] ?? null}
              onPress={openPrediction}
            />
          ))}
        </View>

        {/* Squad */}
        {squad && squad.count > 0 ? (
          <View style={{ marginTop: 24 }}>
            <View style={styles.squadHeader}>
              <Text style={styles.sectionTitle}>{t.team.squad}</Text>
              {squad.coach ? (
                <Text style={styles.coach}>
                  {t.team.coach}: <Text style={styles.coachName}>{squad.coach}</Text>
                </Text>
              ) : null}
            </View>
            {squad.groups.map((g) => (
              <View key={g.position} style={{ marginBottom: 16 }}>
                <Text style={styles.posTitle}>
                  {(t.team.positions as Record<string, string>)[g.position] ?? g.position}
                  <Text style={styles.posCount}> · {g.players.length}</Text>
                </Text>
                <View style={styles.playerGrid}>
                  {g.players.map((p) => (
                    <PlayerRow key={p.id} player={p} yrsLabel={t.team.years} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <PredictionModal
        match={predicting}
        prediction={predicting ? predictions?.[predicting.id] ?? null : null}
        onClose={() => setPredicting(null)}
      />
    </View>
  );
}

function PlayerRow({ player, yrsLabel }: { player: Player; yrsLabel: string }) {
  const age = ageFromDob(player.date_of_birth);
  return (
    <View style={styles.playerRow}>
      <Avatar url={player.photo_url} name={player.name} size={36} ring={false} />
      <Text style={styles.playerName} numberOfLines={1}>
        {player.name}
      </Text>
      {age != null ? (
        <Text style={styles.playerAge}>
          {age} {yrsLabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  squadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  coach: { color: palette.textSecondary, fontSize: 12, marginBottom: 12 },
  coachName: { color: palette.text, fontWeight: '800' },
  posTitle: {
    color: palette.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  posCount: { color: palette.textTertiary, fontWeight: '700' },
  playerGrid: { gap: 8 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  playerName: { flex: 1, color: palette.text, fontSize: 14, fontWeight: '600' },
  playerAge: { color: palette.textSecondary, fontSize: 12, fontWeight: '600' },
  headerInner: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between' },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: { alignItems: 'center', marginTop: 8, gap: 8 },
  flagShadow: { borderRadius: 6, overflow: 'hidden' },
  teamName: { color: palette.text, fontSize: 30, fontWeight: '900' },
  badges: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border2,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  badgeText: {
    color: palette.text,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60 },
  sectionTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
});

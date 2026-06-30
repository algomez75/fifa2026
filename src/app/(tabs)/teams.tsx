import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { FavoriteTeamsRail } from '@/components/FavoriteTeamsRail';
import { Flag } from '@/components/Flag';
import { ScreenHeader } from '@/components/ScreenHeader';
import { HeaderActions } from '@/components/HeaderActions';
import { EmptyState } from '@/components/States';
import { TeamName } from '@/components/TeamName';
import { HeartIcon, SearchIcon } from '@/components/icons';
import type { Team } from '@/lib/database.types';
import { seedTeams } from '@/lib/seed';
import { teamColor } from '@/lib/teamColors';
import { teamMatchesQuery } from '@/lib/teamSearch';
import { palette, radius } from '@/lib/theme';
import { useFavorites } from '@/hooks/useFavorites';
import { useTranslation } from '@/store/useAppStore';

export default function TeamsScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const { favorites } = useFavorites();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return seedTeams;
    return seedTeams.filter((team) => teamMatchesQuery(team, q));
  }, [query]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow={t.teams.eyebrow}
        title={t.teams.title}
        right={<HeaderActions />}
      />

      <View style={styles.searchWrap}>
        <SearchIcon color={palette.textSecondary} size={18} />
        <TextInput
          style={styles.search}
          placeholder={t.teams.searchPlaceholder}
          placeholderTextColor={palette.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        {favorites.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.teams.myFavorites}</Text>
            <FavoriteTeamsRail
              teamIds={favorites}
              onPressTeam={(id) => router.push(`/team/${id}`)}
            />
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>{t.teams.allTeams}</Text>
        {filtered.length === 0 ? (
          <EmptyState emoji="🔎" title={t.teams.noResults} />
        ) : (
          <View style={styles.list}>
            {filtered.map((team) => {
              const isFav = favorites.includes(team.id);
              return (
                <Pressable
                  key={team.id}
                  style={styles.row}
                  onPress={() => router.push(`/team/${team.id}`)}>
                  <CardGradient team={team} />
                  <View style={styles.rowFlag}>
                    {team.iso2 ? (
                      <Flag isoCode={team.iso2} size={30} />
                    ) : (
                      <Text style={{ fontSize: 26 }}>{team.flag_emoji}</Text>
                    )}
                  </View>
                  <View style={styles.rowMid}>
                    <TeamName team={team} language={language} style={styles.rowName} />
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {team.confederation}
                      {team.host_country ? ` · ${t.schedule.filterCountry}` : ''}
                    </Text>
                  </View>
                  {isFav ? <HeartIcon color={palette.gold} size={15} filled /> : null}
                  <View style={styles.groupBadge}>
                    <Text style={styles.groupBadgeText}>{team.group_letter}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** Subtle left→right flag-colour gradient tint behind a team row. Uses SVG (no
 *  extra native module) with a per-team gradient id. */
function CardGradient({ team }: { team: Team }) {
  const color = teamColor(team);
  const id = `tg-${team.id}`;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={color} stopOpacity={0.24} />
          <Stop offset="0.55" stopColor={color} stopOpacity={0.07} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 14,
  },
  search: { flex: 1, color: palette.text, fontSize: 15, paddingVertical: 12 },
  scroll: { paddingHorizontal: 20, paddingBottom: 140 },
  section: { marginBottom: 8 },
  sectionTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    marginTop: 6,
  },
  // Full-width rows: flag-colour gradient · flag · name + confederation ·
  // favorite · group badge. Names never truncate (3-letter code fallback).
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 11,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  rowFlag: { borderRadius: 4, overflow: 'hidden' },
  rowMid: { flex: 1, gap: 2 },
  rowName: { color: palette.text, fontSize: 15, fontWeight: '700' },
  rowSub: {
    color: palette.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  groupBadge: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 7,
    borderRadius: radius.sm,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupBadgeText: { color: palette.gold, fontSize: 12, fontWeight: '800' },
});

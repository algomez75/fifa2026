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
import CountryFlag from 'react-native-country-flag';

import { ScreenHeader } from '@/components/ScreenHeader';
import { HeaderActions } from '@/components/HeaderActions';
import { EmptyState } from '@/components/States';
import { HeartIcon, SearchIcon } from '@/components/icons';
import type { Team } from '@/lib/database.types';
import { teamName } from '@/lib/format';
import { seedTeams, teamsById } from '@/lib/seed';
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

  const favTeams = favorites
    .map((id) => teamsById[id])
    .filter(Boolean) as Team[];

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
        {favTeams.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.teams.myFavorites}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.favRow}>
              {favTeams.map((team) => (
                <Pressable
                  key={team.id}
                  style={styles.favCard}
                  onPress={() => router.push(`/team/${team.id}`)}>
                  {team.iso2 ? (
                    <CountryFlag isoCode={team.iso2} size={34} />
                  ) : (
                    <Text style={{ fontSize: 30 }}>{team.flag_emoji}</Text>
                  )}
                  <Text style={styles.favName} numberOfLines={1}>
                    {teamName(team, language)}
                  </Text>
                  <HeartIcon color={palette.gold} size={14} filled />
                </Pressable>
              ))}
            </ScrollView>
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
                  <View style={styles.rowFlag}>
                    {team.iso2 ? (
                      <CountryFlag isoCode={team.iso2} size={28} />
                    ) : (
                      <Text style={{ fontSize: 24 }}>{team.flag_emoji}</Text>
                    )}
                  </View>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {teamName(team, language)}
                  </Text>
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
  favRow: { gap: 10, paddingBottom: 8 },
  favCard: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.gold,
    padding: 12,
    width: 96,
  },
  favName: { color: palette.text, fontSize: 12, fontWeight: '700', maxWidth: 80 },
  // Full-width rows: flag · full name (never truncates) · favorite · group badge.
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: palette.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowFlag: { borderRadius: 4, overflow: 'hidden' },
  rowName: { flex: 1, color: palette.text, fontSize: 15, fontWeight: '700' },
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

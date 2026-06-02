import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { MatchCard } from '@/components/MatchCard';
import { PredictionModal } from '@/components/PredictionModal';
import { ScreenHeader } from '@/components/ScreenHeader';
import { HeaderActions } from '@/components/HeaderActions';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import type { Match, Stage } from '@/lib/database.types';
import { dayKey, formatMatchDay } from '@/lib/format';
import { venuesById } from '@/lib/seed';
import { palette, radius, stageMeta } from '@/lib/theme';
import { useMatches } from '@/hooks/useMatches';
import { usePredictions } from '@/hooks/usePredictions';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { type HostFilter, useAppStore, useTranslation } from '@/store/useAppStore';

const STAGE_FILTERS: (Stage | 'all')[] = ['all', 'group', 'r32', 'r16', 'qf', 'sf', 'final'];
const HOST_FILTERS: HostFilter[] = ['all', 'USA', 'Mexico', 'Canada'];

export default function ScheduleScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const { data: matches, isLoading, isError, refetch } = useMatches();

  const onlyMyTeams = useAppStore((s) => s.onlyMyTeams);
  const setOnlyMyTeams = useAppStore((s) => s.setOnlyMyTeams);
  const favorites = useAppStore((s) => s.favoriteTeamIds);
  const filterStage = useAppStore((s) => s.filterStage);
  const setFilterStage = useAppStore((s) => s.setFilterStage);
  const filterHost = useAppStore((s) => s.filterHost);
  const setFilterHost = useAppStore((s) => s.setFilterHost);

  const [showPast, setShowPast] = useState(false);
  const [predicting, setPredicting] = useState<Match | null>(null);
  const { data: predictions } = usePredictions();
  const { requireAccount } = useRequireAccount();

  // Predicting needs a real account; let guests still open finished matches to
  // view the result, but prompt them to sign in before an upcoming pick.
  const openPrediction = (m: Match) => {
    const predictable =
      m.status === 'scheduled' && new Date(m.kickoff_utc).getTime() > Date.now();
    if (predictable && !requireAccount()) return;
    setPredicting(m);
  };

  const { upcoming, past } = useMemo(() => {
    const all = matches ?? [];
    const filtered = all.filter((m) => {
      if (filterStage !== 'all' && m.stage !== filterStage) return false;
      if (filterHost !== 'all') {
        const v = m.venue_id ? venuesById[m.venue_id] : undefined;
        if (v?.country !== filterHost) return false;
      }
      if (onlyMyTeams && favorites.length) {
        if (
          !favorites.includes(m.home_team_id ?? '') &&
          !favorites.includes(m.away_team_id ?? '')
        )
          return false;
      }
      return true;
    });
    const upcomingM = filtered.filter((m) => m.status !== 'finished');
    const pastM = filtered
      .filter((m) => m.status === 'finished')
      .sort(
        (a, b) =>
          new Date(b.kickoff_utc).getTime() - new Date(a.kickoff_utc).getTime(),
      );
    return { upcoming: groupByDay(upcomingM), past: pastM };
  }, [matches, filterStage, filterHost, onlyMyTeams, favorites]);

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow={t.schedule.eyebrow}
        title={t.schedule.title}
        right={<HeaderActions />}
      />

      {/* Filters */}
      <View style={styles.filters}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          {HOST_FILTERS.map((h) => (
            <Chip
              key={h}
              label={h === 'all' ? t.schedule.filterAll : h}
              active={filterHost === h}
              onPress={() => setFilterHost(h)}
            />
          ))}
          <View style={styles.sep} />
          {STAGE_FILTERS.map((s) => (
            <Chip
              key={s}
              label={
                s === 'all'
                  ? t.schedule.filterStage
                  : language === 'es'
                    ? stageMeta[s].labelEs
                    : stageMeta[s].short
              }
              active={filterStage === s}
              onPress={() => setFilterStage(s)}
            />
          ))}
        </ScrollView>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{t.schedule.onlyMyTeams}</Text>
          <Switch
            value={onlyMyTeams}
            onValueChange={setOnlyMyTeams}
            trackColor={{ true: palette.gold, false: palette.card }}
            thumbColor={palette.text}
          />
        </View>
      </View>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : upcoming.length === 0 && past.length === 0 ? (
        <EmptyState subtitle={t.teams.noResults} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}>
          <Text style={styles.hint}>{t.predict.cta} · +3 / +1 {t.predict.pts}</Text>
          {upcoming.map((group) => (
            <View key={group.key} style={styles.daySection}>
              <Text style={styles.dayHeader}>
                {formatMatchDay(group.matches[0].kickoff_utc, language)}
              </Text>
              <View style={{ gap: 10 }}>
                {group.matches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    prediction={predictions?.[m.id] ?? null}
                    onPress={openPrediction}
                  />
                ))}
              </View>
            </View>
          ))}

          {past.length ? (
            <View style={styles.pastWrap}>
              <Pressable
                style={styles.pastHeader}
                onPress={() => setShowPast((v) => !v)}>
                <Text style={styles.pastTitle}>
                  {t.schedule.pastResults} ({past.length})
                </Text>
                <Text style={styles.pastChevron}>{showPast ? '▲' : '▼'}</Text>
              </Pressable>
              {showPast ? (
                <View style={{ gap: 10, marginTop: 10 }}>
                  {past.map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      prediction={predictions?.[m.id] ?? null}
                      onPress={openPrediction}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      )}

      <PredictionModal
        match={predicting}
        prediction={predicting ? predictions?.[predicting.id] ?? null : null}
        onClose={() => setPredicting(null)}
      />
    </View>
  );
}

interface DayGroup {
  key: string;
  matches: Match[];
}

function groupByDay(matches: Match[]): DayGroup[] {
  const sorted = [...matches].sort(
    (a, b) => new Date(a.kickoff_utc).getTime() - new Date(b.kickoff_utc).getTime(),
  );
  const map = new Map<string, Match[]>();
  for (const m of sorted) {
    const k = dayKey(m.kickoff_utc);
    (map.get(k) ?? map.set(k, []).get(k)!).push(m);
  }
  return Array.from(map.entries()).map(([key, ms]) => ({ key, matches: ms }));
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  filters: { paddingBottom: 8 },
  chipRow: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  sep: { width: 1, height: 20, backgroundColor: palette.border2, marginHorizontal: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
  },
  chipActive: { backgroundColor: palette.goldDim, borderColor: palette.gold },
  chipText: { color: palette.textSecondary, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: palette.gold },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 12,
  },
  toggleLabel: { color: palette.text, fontSize: 14, fontWeight: '600' },
  scroll: { paddingHorizontal: 20, paddingBottom: 140 },
  hint: { color: palette.textTertiary, fontSize: 12, marginBottom: 14, textAlign: 'center' },
  daySection: { marginBottom: 22 },
  dayHeader: {
    color: palette.gold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  pastWrap: { marginTop: 8, marginBottom: 20 },
  pastHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pastTitle: { color: palette.text, fontSize: 14, fontWeight: '800' },
  pastChevron: { color: palette.textSecondary, fontSize: 12 },
});

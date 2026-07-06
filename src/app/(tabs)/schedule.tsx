import { type Href, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { MatchCard } from '@/components/MatchCard';
import { Flag } from '@/components/Flag';
import { PredictionModal } from '@/components/PredictionModal';
import { ScreenHeader } from '@/components/ScreenHeader';
import { HeaderActions } from '@/components/HeaderActions';
import { LocationPinIcon } from '@/components/icons';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import type { Match } from '@/lib/database.types';
import { dayKey, formatMatchDay } from '@/lib/format';
import { venuesById } from '@/lib/seed';
import { palette, radius } from '@/lib/theme';
import { useMatches } from '@/hooks/useMatches';
import { useResolveMatch } from '@/hooks/useResolveMatch';
import { usePredictions } from '@/hooks/usePredictions';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { type HostFilter, useAppStore, useTranslation } from '@/store/useAppStore';

const HOST_FILTERS: HostFilter[] = ['all', 'USA', 'Mexico', 'Canada'];
const HOST_ISO: Record<Exclude<HostFilter, 'all'>, string> = {
  USA: 'US',
  Mexico: 'MX',
  Canada: 'CA',
};

export default function ScheduleScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const { data: matches, isLoading, isError, refetch } = useMatches();
  // Same resolver as the Bracket: fills every undecided knockout side in real
  // time — clinched group teams for R32 AND winner/loser progression for
  // R16→Final — so Upcoming always shows the real teams the moment they're known.
  const resolve = useResolveMatch();

  const onlyMyTeams = useAppStore((s) => s.onlyMyTeams);
  const setOnlyMyTeams = useAppStore((s) => s.setOnlyMyTeams);
  const favorites = useAppStore((s) => s.favoriteTeamIds);
  const filterHost = useAppStore((s) => s.filterHost);
  const setFilterHost = useAppStore((s) => s.setFilterHost);

  const [view, setView] = useState<'upcoming' | 'results'>('upcoming');
  const [predicting, setPredicting] = useState<Match | null>(null);
  const { data: predictions } = usePredictions();
  const { requireAccount } = useRequireAccount();

  // Upcoming matches open the prediction sheet (account required); live and
  // finished ones open the full match detail (stats, lineups, events).
  const openPrediction = (m: Match) => {
    if (m.status !== 'scheduled') {
      router.push(`/match/${m.id}` as Href);
      return;
    }
    const predictable = new Date(m.kickoff_utc).getTime() > Date.now();
    if (predictable && !requireAccount()) return;
    setPredicting(m);
  };

  const { liveNow, upcoming, past, pastCount } = useMemo(() => {
    const all = matches ?? [];
    const filtered = all.filter((m) => {
      if (filterHost !== 'all') {
        const v = m.venue_id ? venuesById[m.venue_id] : undefined;
        if (v?.country !== filterHost) return false;
      }
      if (onlyMyTeams && favorites.length) {
        // Resolve knockout sides so a favorite that just clinched/advanced into
        // a knockout slot shows here too (matches the bracket).
        const rm = resolve(m).match;
        if (
          !favorites.includes(rm.home_team_id ?? '') &&
          !favorites.includes(rm.away_team_id ?? '')
        )
          return false;
      }
      return true;
    });
    const liveM = filtered.filter((m) => m.status === 'live');
    const upcomingM = filtered.filter((m) => m.status === 'scheduled');
    const pastM = filtered
      .filter((m) => m.status === 'finished')
      .sort(
        (a, b) =>
          new Date(b.kickoff_utc).getTime() - new Date(a.kickoff_utc).getTime(),
      );
    return {
      liveNow: liveM,
      upcoming: groupByDay(upcomingM),
      past: groupByDayDesc(pastM),
      pastCount: pastM.length,
    };
  }, [matches, filterHost, onlyMyTeams, favorites, resolve]);

  // Render a card with the knockout sides resolved like the Bracket: `r.match`
  // fills undecided sides (flag + name) in every round; `qualMark` carries the
  // locked/provisional marker. Prediction identity stays `match.id`.
  const cardFor = (m: Match) => {
    const r = resolve(m);
    return (
      <MatchCard
        key={m.id}
        match={r.match}
        prediction={predictions?.[m.id] ?? null}
        onPress={openPrediction}
        qualMark={{ home: r.home, away: r.away }}
      />
    );
  };

  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow={t.schedule.eyebrow}
        title={t.schedule.title}
        right={<HeaderActions />}
      />

      {/* Host filters — minimalist flag chips */}
      <View style={styles.filters}>
        <View style={styles.chipRow}>
          {HOST_FILTERS.map((h) => (
            <HostChip
              key={h}
              host={h}
              active={filterHost === h}
              onPress={() => setFilterHost(h)}
            />
          ))}
        </View>
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

      {/* Upcoming ↔ Results segmented control */}
      <View style={styles.segmentRow}>
        <Pressable
          onPress={() => setView('upcoming')}
          style={[styles.segment, view === 'upcoming' && styles.segmentOn]}>
          <Text style={[styles.segmentText, view === 'upcoming' && styles.segmentTextOn]}>
            {t.schedule.upcoming}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setView('results')}
          style={[styles.segment, view === 'results' && styles.segmentOn]}>
          <Text style={[styles.segmentText, view === 'results' && styles.segmentTextOn]}>
            {t.schedule.pastResults}
            {pastCount ? ` · ${pastCount}` : ''}
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}>
          {view === 'upcoming' ? (
            <>
              {liveNow.length ? (
                <View style={styles.daySection}>
                  <Text style={[styles.dayHeader, { color: palette.live }]}>
                    ● {t.home.liveNow}
                  </Text>
                  <View style={{ gap: 10 }}>{liveNow.map(cardFor)}</View>
                </View>
              ) : null}
              {upcoming.length === 0 && liveNow.length === 0 ? (
                <EmptyState subtitle={t.teams.noResults} />
              ) : (
                <Text style={styles.hint}>
                  {t.predict.cta} · +3 / +1 {t.predict.pts}
                </Text>
              )}
              {upcoming.map((group) => (
                <View key={group.key} style={styles.daySection}>
                  <Text style={styles.dayHeader}>
                    {formatMatchDay(group.matches[0].kickoff_utc, language)}
                  </Text>
                  <View style={{ gap: 10 }}>{group.matches.map(cardFor)}</View>
                </View>
              ))}
            </>
          ) : past.length === 0 ? (
            <EmptyState subtitle={t.teams.noResults} />
          ) : (
            past.map((group) => (
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
            ))
          )}
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

/** Results view: most recent match day first. */
function groupByDayDesc(matches: Match[]): DayGroup[] {
  const map = new Map<string, Match[]>();
  for (const m of matches) {
    const k = dayKey(m.kickoff_utc);
    (map.get(k) ?? map.set(k, []).get(k)!).push(m);
  }
  return Array.from(map.entries()).map(([key, ms]) => ({ key, matches: ms }));
}

/** Minimalist host filter: a location pin for "all", flag swatch per country.
 *  Inactive flags are dimmed; the selected one lights up with a gold ring. */
function HostChip({
  host,
  active,
  onPress,
}: {
  host: HostFilter;
  active: boolean;
  onPress: () => void;
}) {
  if (host === 'all') {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.hostChip, active && styles.hostChipActive]}>
        <LocationPinIcon
          color={active ? palette.gold : palette.textSecondary}
          size={18}
        />
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={[styles.flagChip, active ? styles.flagChipActive : styles.flagChipOff]}>
      <Flag isoCode={HOST_ISO[host]} size={42} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  filters: { paddingBottom: 8 },
  chipRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, alignItems: 'center' },
  hostChip: {
    width: 44,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hostChipActive: { backgroundColor: palette.goldDim, borderColor: palette.gold },
  flagChip: {
    width: 44,
    height: 30,
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  flagChipOff: { borderColor: palette.border, opacity: 0.4 },
  flagChipActive: { borderColor: palette.gold, opacity: 1 },
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
  segmentRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: palette.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  segmentOn: { backgroundColor: palette.goldDim, borderWidth: 1, borderColor: palette.gold },
  segmentText: { color: palette.textSecondary, fontSize: 13, fontWeight: '800' },
  segmentTextOn: { color: palette.gold },
});

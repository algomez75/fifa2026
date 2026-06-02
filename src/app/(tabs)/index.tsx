import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Countdown } from '@/components/Countdown';
import { GlassCard } from '@/components/GlassCard';
import { GoalOverlay } from '@/components/GoalOverlay';
import { HeaderActions } from '@/components/HeaderActions';
import { LiveBadge } from '@/components/LiveBadge';
import { MatchCard } from '@/components/MatchCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { TeamFlag } from '@/components/TeamFlag';
import type { Match } from '@/lib/database.types';
import { formatMatchDay, isMatchToday, nextMatch } from '@/lib/format';
import { teamsById } from '@/lib/seed';
import { isSupabaseConfigured } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import { useMatches } from '@/hooks/useMatches';
import { useMatchRealtime } from '@/hooks/useMatchRealtime';
import { useAppStore, useTranslation } from '@/store/useAppStore';

export default function HomeScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const favorites = useAppStore((s) => s.favoriteTeamIds);
  const { data: matches, isLoading, isError, refetch } = useMatches();
  const [goalLabel, setGoalLabel] = useState<string | null>(null);
  useMatchRealtime((e) => {
    const home = e.match.home_team_id ? teamsById[e.match.home_team_id] : undefined;
    const away = e.match.away_team_id ? teamsById[e.match.away_team_id] : undefined;
    setGoalLabel(
      `${home?.name ?? ''} ${e.match.home_score}–${e.match.away_score} ${away?.name ?? ''}`.trim(),
    );
  });

  const derived = useMemo(() => {
    const all = matches ?? [];
    const live = all.filter((m) => m.status === 'live');
    const today = all.filter(
      (m) => isMatchToday(m.kickoff_utc) && m.status !== 'finished',
    );
    const upNext = nextMatch(all);
    const favMatches = favorites
      .map((teamId) =>
        all.find(
          (m) =>
            m.status !== 'finished' &&
            (m.home_team_id === teamId || m.away_team_id === teamId),
        ),
      )
      .filter(Boolean) as Match[];
    return { live, today, upNext, favMatches };
  }, [matches, favorites]);

  if (isLoading) return <ScreenFrame><LoadingState /></ScreenFrame>;
  if (isError) return <ScreenFrame><ErrorState onRetry={refetch} /></ScreenFrame>;

  const { live, today, upNext, favMatches } = derived;
  const hasLive = live.length > 0;

  return (
    <ScreenFrame>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        {/* Hero countdown / live */}
        <GlassCard style={styles.hero} accent={palette.gold}>
          {hasLive ? (
            <View style={styles.heroLive}>
              <LiveBadge />
              <Text style={styles.heroLiveText}>{t.home.liveNow}</Text>
            </View>
          ) : upNext ? (
            <View>
              <Text style={styles.heroLabel}>{t.home.nextMatch}</Text>
              <View style={styles.heroTeams}>
                <TeamFlag
                  team={upNext.home_team_id ? teamsById[upNext.home_team_id] : undefined}
                  size={24}
                />
                <Text style={styles.heroVs}>{t.common.vs}</Text>
                <TeamFlag
                  team={upNext.away_team_id ? teamsById[upNext.away_team_id] : undefined}
                  size={24}
                  reverse
                />
              </View>
              <Text style={styles.heroDay}>
                {formatMatchDay(upNext.kickoff_utc, language)}
              </Text>
              <View style={{ marginTop: 14 }}>
                <Countdown target={upNext.kickoff_utc} onComplete={refetch} />
              </View>
            </View>
          ) : (
            <EmptyState emoji="🏆" title={t.common.emptyTitle} />
          )}
        </GlassCard>

        {!isSupabaseConfigured ? (
          <Text style={styles.seedNote}>{t.common.seedNotice}</Text>
        ) : null}

        {/* Your teams */}
        <Section title={t.home.yourTeams}>
          {favMatches.length ? (
            favMatches.map((m) => (
              <MatchCard key={m.id} match={m} onPress={() => openMatchTeam(m)} />
            ))
          ) : (
            <Pressable
              onPress={() => router.push('/teams')}
              style={({ pressed }) => pressed && { opacity: 0.85 }}>
              <GlassCard accent={palette.gold}>
                <View style={styles.ctaRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ctaTitle}>{t.home.yourTeamsEmpty}</Text>
                    <Text style={styles.ctaAction}>{t.home.chooseTeams}</Text>
                  </View>
                  <Text style={styles.ctaChevron}>›</Text>
                </View>
              </GlassCard>
            </Pressable>
          )}
        </Section>

        {/* Live matches */}
        {hasLive ? (
          <Section title={t.home.liveMatches}>
            {live.map((m) => (
              <MatchCard key={m.id} match={m} onPress={() => openMatchTeam(m)} />
            ))}
          </Section>
        ) : null}

        {/* Today */}
        <Section title={t.home.todaysMatches}>
          {today.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}>
              {today.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  compact
                  onPress={() => openMatchTeam(m)}
                />
              ))}
            </ScrollView>
          ) : (
            <GlassCard>
              <Text style={styles.emptyInline}>{t.home.noMatchesToday}</Text>
            </GlassCard>
          )}
        </Section>
      </ScrollView>
      <GoalOverlay
        visible={goalLabel != null}
        label={goalLabel ?? undefined}
        onDone={() => setGoalLabel(null)}
      />
    </ScreenFrame>
  );

  function openMatchTeam(m: Match) {
    const id = m.home_team_id ?? m.away_team_id;
    if (id) router.push(`/team/${id}`);
  }
}

function ScreenFrame({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <View style={styles.screen}>
      <ScreenHeader
        eyebrow={t.home.eyebrow}
        title={t.home.title}
        right={<HeaderActions />}
      />
      {children}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 140, gap: 4 },
  hero: { marginBottom: 8 },
  heroLabel: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroTeams: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 },
  heroVs: { color: palette.textTertiary, fontWeight: '800' },
  heroDay: { color: palette.gold, fontSize: 13, fontWeight: '700', marginTop: 8 },
  heroLive: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  heroLiveText: { color: palette.text, fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
  seedNote: {
    color: palette.textTertiary,
    fontSize: 11,
    textAlign: 'center',
    marginVertical: 8,
  },
  section: { marginTop: 18 },
  sectionTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  hScroll: { gap: 12, paddingRight: 8 },
  emptyInline: { color: palette.textSecondary, fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ctaTitle: { color: palette.text, fontSize: 15, fontWeight: '700' },
  ctaAction: { color: palette.gold, fontSize: 13, fontWeight: '700', marginTop: 2 },
  ctaChevron: { color: palette.gold, fontSize: 28, fontWeight: '300' },
});

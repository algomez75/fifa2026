import { type Href, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Countdown } from '@/components/Countdown';
import { GlassCard } from '@/components/GlassCard';
import { HeaderActions } from '@/components/HeaderActions';
import { LiveHero } from '@/components/LiveHero';
import { MatchCard } from '@/components/MatchCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { TeamFlag } from '@/components/TeamFlag';
import { TopScorersCard } from '@/components/TopScorersCard';
import type { Match } from '@/lib/database.types';
import { formatMatchDay, isMatchToday, nextMatch } from '@/lib/format';
import { teamsById } from '@/lib/seed';
import { isSupabaseConfigured } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import { useMatches } from '@/hooks/useMatches';
import { useAppStore, useTranslation } from '@/store/useAppStore';

export default function HomeScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const favorites = useAppStore((s) => s.favoriteTeamIds);
  const { data: matches, isLoading, isError, refetch } = useMatches();

  const derived = useMemo(() => {
    const all = matches ?? [];
    const live = all.filter((m) => m.status === 'live');
    const today = all.filter(
      (m) => isMatchToday(m.kickoff_utc) && m.status !== 'finished',
    );
    const upNext = nextMatch(all);
    // Scheduled matches beyond today are inherently in the future (past
    // matches are live/finished), so no clock check is needed here.
    const upcomingNext = all
      .filter((m) => m.status === 'scheduled' && !isMatchToday(m.kickoff_utc))
      .sort(
        (a, b) =>
          new Date(a.kickoff_utc).getTime() - new Date(b.kickoff_utc).getTime(),
      )
      .slice(0, 6);
    const favMatches = favorites
      .map((teamId) =>
        all.find(
          (m) =>
            m.status !== 'finished' &&
            (m.home_team_id === teamId || m.away_team_id === teamId),
        ),
      )
      .filter(Boolean) as Match[];
    return { live, today, upNext, upcomingNext, favMatches };
  }, [matches, favorites]);

  if (isLoading) return <ScreenFrame><LoadingState /></ScreenFrame>;
  if (isError) return <ScreenFrame><ErrorState onRetry={refetch} /></ScreenFrame>;

  const { live, today, upNext, upcomingNext, favMatches } = derived;
  const hasLive = live.length > 0;

  return (
    <ScreenFrame>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>
        {/* Hero: live scoreboard(s) while matches are on, else countdown */}
        {hasLive ? (
          <View style={styles.hero}>
            <LiveHero matches={live} onPressMatch={openMatchTeam} />
          </View>
        ) : (
        <GlassCard style={styles.hero} accent={palette.gold}>
          {upNext ? (
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
        )}

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

        {/* Coming up (beyond today) */}
        {upcomingNext.length ? (
          <Section title={t.schedule.upcoming}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.hScroll}>
              {upcomingNext.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  compact
                  onPress={() => openMatchTeam(m)}
                />
              ))}
            </ScrollView>
          </Section>
        ) : null}

        {/* Golden boot */}
        <Section title={`👟 ${t.home.topScorers}`}>
          <TopScorersCard limit={5} />
        </Section>
      </ScrollView>
    </ScreenFrame>
  );

  function openMatchTeam(m: Match) {
    // Live/finished matches open the full detail (stats, lineups, events);
    // upcoming ones go to the team page as before.
    if (m.status !== 'scheduled') {
      router.push(`/match/${m.id}` as Href);
      return;
    }
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

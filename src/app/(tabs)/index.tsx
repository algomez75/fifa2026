import { type Href, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Countdown } from '@/components/Countdown';
import { DelayBadge } from '@/components/DelayBadge';
import { FavoriteTeamsRail } from '@/components/FavoriteTeamsRail';
import { GlassCard } from '@/components/GlassCard';
import { HeaderActions } from '@/components/HeaderActions';
import { LiveHero } from '@/components/LiveHero';
import { MatchCard } from '@/components/MatchCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/States';
import { TeamFlag } from '@/components/TeamFlag';
import { TopScorersCard } from '@/components/TopScorersCard';
import type { Match } from '@/lib/database.types';
import { isMatchToday, matchDayLabel, nextMatch } from '@/lib/format';
import { teamsById, venuesById } from '@/lib/seed';
import { isSupabaseConfigured } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import { useMatches } from '@/hooks/useMatches';
import { usePredictions } from '@/hooks/usePredictions';
import { useResolveMatch } from '@/hooks/useResolveMatch';
import { useAppStore, useTranslation } from '@/store/useAppStore';

export default function HomeScreen() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const favorites = useAppStore((s) => s.favoriteTeamIds);
  const { data: matches, isLoading, isError, refetch } = useMatches();
  const { data: predictions } = usePredictions();
  const resolve = useResolveMatch();

  const derived = useMemo(() => {
    const all = matches ?? [];
    const live = all.filter((m) => m.status === 'live');
    const today = all.filter(
      (m) => isMatchToday(m.kickoff_utc) && m.status !== 'finished',
    );
    const upNext = nextMatch(all);
    return { live, today, upNext };
  }, [matches]);

  if (isLoading) return <ScreenFrame><LoadingState /></ScreenFrame>;
  if (isError) return <ScreenFrame><ErrorState onRetry={refetch} /></ScreenFrame>;

  const { live, today, upNext } = derived;
  const hasLive = live.length > 0;
  // Fill an undecided knockout next-match with its qualified teams.
  const heroMatch = upNext ? resolve(upNext).match : undefined;

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
            <Pressable
              onPress={() => router.push(`/match/${upNext.id}` as Href)}
              style={({ pressed }) => pressed && { opacity: 0.9 }}>
              <View style={styles.heroLabelRow}>
                <Text style={styles.heroLabel}>{t.home.nextMatch}</Text>
                <Text style={styles.heroChevron}>›</Text>
              </View>
              <View style={styles.heroTeams}>
                <TeamFlag
                  team={heroMatch?.home_team_id ? teamsById[heroMatch.home_team_id] : undefined}
                  size={24}
                />
                <Text style={styles.heroVs}>{t.common.vs}</Text>
                <TeamFlag
                  team={heroMatch?.away_team_id ? teamsById[heroMatch.away_team_id] : undefined}
                  size={24}
                  reverse
                />
              </View>
              <Text style={styles.heroDay}>
                {matchDayLabel(upNext.kickoff_utc, language, t.common.today)}
              </Text>
              {upNext.venue_id && venuesById[upNext.venue_id] ? (
                <Text style={styles.heroVenue} numberOfLines={1}>
                  📍 {venuesById[upNext.venue_id].name} · {venuesById[upNext.venue_id].city}
                </Text>
              ) : null}
              {heroMatch?.delay_status ? (
                <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
                  <DelayBadge match={heroMatch} />
                </View>
              ) : (
                <View style={{ marginTop: 14 }}>
                  <Countdown target={upNext.kickoff_utc} onComplete={refetch} />
                </View>
              )}
            </Pressable>
          ) : (
            <EmptyState emoji="🏆" title={t.common.emptyTitle} />
          )}
        </GlassCard>
        )}

        {!isSupabaseConfigured ? (
          <Text style={styles.seedNote}>{t.common.seedNotice}</Text>
        ) : null}

        {/* Your teams — minimalist flag carousel → team page (group + results) */}
        <Section title={t.home.yourTeams}>
          {favorites.length ? (
            <FavoriteTeamsRail
              teamIds={favorites}
              onPressTeam={(id) => router.push(`/team/${id}`)}
            />
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

        {/* Today — full-width cards, same as Your teams */}
        <Section title={t.home.todaysMatches}>
          {today.length ? (
            today.map((m) => {
              const { match, home, away } = resolve(m);
              return (
                <MatchCard
                  key={m.id}
                  match={match}
                  prediction={predictions?.[m.id] ?? null}
                  onPress={() => openMatchTeam(match)}
                  qualMark={{ home, away }}
                />
              );
            })
          ) : (
            <GlassCard>
              <Text style={styles.emptyInline}>{t.home.noMatchesToday}</Text>
            </GlassCard>
          )}
        </Section>

        {/* Golden boot */}
        <Section title={`👟 ${t.home.topScorers}`} titleColor={palette.gold}>
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

function Section({
  title,
  children,
  titleColor,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  titleColor?: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, titleColor ? { color: titleColor } : null]}>{title}</Text>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 140, gap: 4 },
  hero: { marginBottom: 8 },
  heroLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroLabel: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroChevron: { color: palette.gold, fontSize: 22, fontWeight: '300', marginTop: -4 },
  heroTeams: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 },
  heroVs: { color: palette.textTertiary, fontWeight: '800' },
  heroDay: { color: palette.gold, fontSize: 13, fontWeight: '700', marginTop: 8 },
  heroVenue: { color: palette.textTertiary, fontSize: 12, marginTop: 6 },
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
  emptyInline: { color: palette.textSecondary, fontSize: 14, textAlign: 'center', paddingVertical: 8 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ctaTitle: { color: palette.text, fontSize: 15, fontWeight: '700' },
  ctaAction: { color: palette.gold, fontSize: 13, fontWeight: '700', marginTop: 2 },
  ctaChevron: { color: palette.gold, fontSize: 28, fontWeight: '300' },
});

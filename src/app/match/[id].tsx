import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { GlassCard } from '@/components/GlassCard';
import { LiveBadge } from '@/components/LiveBadge';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/States';
import { TeamFlag } from '@/components/TeamFlag';
import { useMatchDetail, type LineupPlayer, type MatchDetail } from '@/hooks/useMatchDetail';
import { useMatchEvents } from '@/hooks/useMatchEvents';
import { useMatches } from '@/hooks/useMatches';
import { teamName } from '@/lib/format';
import { teamsById, venuesById } from '@/lib/seed';
import { palette, radius } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';

/** Ordered, bilingual map of football-data team statistics keys. */
const STAT_ROWS: { key: string; en: string; es: string; pct?: boolean }[] = [
  { key: 'ball_possession', en: 'Possession %', es: 'Posesión %', pct: true },
  { key: 'shots', en: 'Shots', es: 'Tiros' },
  { key: 'shots_on_goal', en: 'Shots on goal', es: 'Tiros al arco' },
  { key: 'corner_kicks', en: 'Corners', es: 'Córners' },
  { key: 'fouls', en: 'Fouls', es: 'Faltas' },
  { key: 'offsides', en: 'Offsides', es: 'Fueras de juego' },
  { key: 'saves', en: 'Saves', es: 'Atajadas' },
  { key: 'yellow_cards', en: 'Yellow cards', es: 'Amarillas' },
  { key: 'red_cards', en: 'Red cards', es: 'Rojas' },
];

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useTranslation();
  const router = useRouter();
  const { data: matches } = useMatches();
  const { data: detail } = useMatchDetail(id);
  const { data: events } = useMatchEvents();
  const [side, setSide] = useState<'home' | 'away'>('home');

  const match = (matches ?? []).find((m) => m.id === id);
  const home = match?.home_team_id ? teamsById[match.home_team_id] : undefined;
  const away = match?.away_team_id ? teamsById[match.away_team_id] : undefined;
  const venue = match?.venue_id ? venuesById[match.venue_id] : undefined;

  const matchEvents = useMemo(
    () => (events ?? []).filter((e) => e.match_id === id),
    [events, id],
  );

  if (!match) {
    return (
      <View style={styles.screen}>
        <ScreenHeader eyebrow="" title={t.common.errorTitle} />
        <EmptyState />
      </View>
    );
  }

  const isLive = match.status === 'live';
  const isFinished = match.status === 'finished';
  const es = language === 'es';

  const statsAvailable = !!(detail?.home_stats && detail?.away_stats);
  const lineupAvailable = !!(detail?.home_lineup?.length || detail?.away_lineup?.length);

  // Fallback stat rows we can always compute (cards from events).
  const yellow = (teamId: string | null | undefined) =>
    matchEvents.filter((e) => e.type === 'yellow' && e.team_id === teamId).length;
  const red = (teamId: string | null | undefined) =>
    matchEvents.filter((e) => e.type === 'red' && e.team_id === teamId).length;

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Scoreboard header */}
        <GlassCard accent={isLive ? palette.live : palette.gold}>
          <View style={styles.topRow}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.back}>‹</Text>
            </Pressable>
            {isLive ? (
              <LiveBadge minute={match.minute} />
            ) : (
              <Text style={styles.ft}>{isFinished ? t.common.ft : ''}</Text>
            )}
            <View style={{ width: 20 }} />
          </View>
          <View style={styles.scoreRow}>
            <View style={styles.team}>
              <TeamFlag team={home} size={42} showName={false} />
              <Text style={styles.teamName} numberOfLines={1}>
                {teamName(home, language)}
              </Text>
            </View>
            <Text style={styles.score}>
              {match.home_score ?? '–'}
              <Text style={styles.scoreSep}> : </Text>
              {match.away_score ?? '–'}
            </Text>
            <View style={styles.team}>
              <TeamFlag team={away} size={42} showName={false} />
              <Text style={styles.teamName} numberOfLines={1}>
                {teamName(away, language)}
              </Text>
            </View>
          </View>
          {venue ? (
            <Text style={styles.venue} numberOfLines={1}>
              📍 {venue.name} · {venue.city}
              {detail?.attendance ? `  ·  👥 ${detail.attendance.toLocaleString()}` : ''}
            </Text>
          ) : null}
          {detail?.referee ? (
            <Text style={styles.referee}>🟡 {detail.referee}</Text>
          ) : null}
        </GlassCard>

        {/* Team stats with bars */}
        <Text style={styles.sectionTitle}>{es ? 'Estadísticas' : 'Team stats'}</Text>
        <GlassCard>
          {statsAvailable ? (
            <View style={{ gap: 14 }}>
              {STAT_ROWS.map((row) => {
                const h = Number(detail!.home_stats![row.key] ?? NaN);
                const a = Number(detail!.away_stats![row.key] ?? NaN);
                if (isNaN(h) && isNaN(a)) return null;
                return (
                  <StatBar
                    key={row.key}
                    label={es ? row.es : row.en}
                    home={isNaN(h) ? 0 : h}
                    away={isNaN(a) ? 0 : a}
                  />
                );
              })}
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              <StatBar
                label={es ? 'Goles' : 'Goals'}
                home={match.home_score ?? 0}
                away={match.away_score ?? 0}
              />
              <StatBar
                label={es ? 'Amarillas' : 'Yellow cards'}
                home={yellow(match.home_team_id)}
                away={yellow(match.away_team_id)}
              />
              <StatBar
                label={es ? 'Rojas' : 'Red cards'}
                home={red(match.home_team_id)}
                away={red(match.away_team_id)}
              />
              <Text style={styles.statsNote}>
                {es
                  ? 'Posesión, tiros y más estadísticas — muy pronto.'
                  : 'Possession, shots and more stats — coming soon.'}
              </Text>
            </View>
          )}
        </GlassCard>

        {/* Lineups */}
        <Text style={styles.sectionTitle}>{es ? 'Alineaciones' : 'Starting lineup'}</Text>
        {lineupAvailable && detail ? (
          <GlassCard>
            {/* formation selector */}
            <View style={styles.formationRow}>
              <Pressable
                onPress={() => setSide('home')}
                style={[styles.formationChip, side === 'home' && styles.formationChipOn]}>
                <TeamFlag team={home} size={16} showName={false} />
                <Text
                  style={[styles.formationText, side === 'home' && styles.formationTextOn]}>
                  {detail.home_formation ?? teamName(home, language)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSide('away')}
                style={[styles.formationChip, side === 'away' && styles.formationChipOn]}>
                <TeamFlag team={away} size={16} showName={false} />
                <Text
                  style={[styles.formationText, side === 'away' && styles.formationTextOn]}>
                  {detail.away_formation ?? teamName(away, language)}
                </Text>
              </Pressable>
            </View>

            <Pitch
              lineup={(side === 'home' ? detail.home_lineup : detail.away_lineup) ?? []}
              formation={side === 'home' ? detail.home_formation : detail.away_formation}
              events={matchEvents}
            />

            {/* bench + subs */}
            <BenchAndSubs detail={detail} side={side} es={es} />
          </GlassCard>
        ) : (
          <GlassCard>
            <Text style={styles.statsNote}>
              {es
                ? 'Las alineaciones aparecen ~1 hora antes del partido.'
                : 'Lineups appear ~1 hour before kickoff.'}
            </Text>
          </GlassCard>
        )}
      </ScrollView>
    </View>
  );
}

/** Apple-Sports-style two-sided proportional bar. */
function StatBar({ label, home, away }: { label: string; home: number; away: number }) {
  const total = home + away;
  const hPct = total > 0 ? home / total : 0.5;
  return (
    <View>
      <View style={styles.statTop}>
        <Text style={styles.statValue}>{home}</Text>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{away}</Text>
      </View>
      <View style={styles.statBars}>
        <View style={styles.statTrack}>
          <View
            style={[styles.statFill, styles.statFillHome, { flex: Math.max(hPct, 0.02) }]}
          />
          <View style={{ flex: Math.max(1 - hPct, 0.02) }} />
        </View>
        <View style={styles.statTrack}>
          <View style={{ flex: Math.max(hPct, 0.02) }} />
          <View
            style={[styles.statFill, styles.statFillAway, { flex: Math.max(1 - hPct, 0.02) }]}
          />
        </View>
      </View>
    </View>
  );
}

/** Vertical pitch: GK at the bottom, attackers on top, rows from the formation. */
function Pitch({
  lineup,
  formation,
  events,
}: {
  lineup: LineupPlayer[];
  formation: string | null;
  events: { type: string; player_id: number | null; player_name: string | null }[];
}) {
  const rows = useMemo(() => {
    if (!lineup.length) return [] as LineupPlayer[][];
    const [gk, ...rest] = lineup;
    const counts = (formation ?? '4-4-2')
      .split('-')
      .map((n) => parseInt(n, 10))
      .filter((n) => !isNaN(n) && n > 0);
    const lines: LineupPlayer[][] = [[gk]];
    let i = 0;
    for (const c of counts) {
      lines.push(rest.slice(i, i + c));
      i += c;
    }
    if (i < rest.length) lines.push(rest.slice(i)); // leftovers safety
    return lines.reverse(); // attack on top, GK at the bottom
  }, [lineup, formation]);

  const badge = (p: LineupPlayer) => {
    const mine = events.filter(
      (e) =>
        (p.player_id != null && e.player_id === p.player_id) ||
        (e.player_name != null && p.name != null && e.player_name === p.name),
    );
    let out = '';
    if (mine.some((e) => e.type === 'goal')) out += '⚽';
    if (mine.some((e) => e.type === 'yellow')) out += '🟨';
    if (mine.some((e) => e.type === 'red')) out += '🟥';
    return out;
  };

  return (
    <View style={styles.pitch}>
      {rows.map((line, li) => (
        <View key={li} style={styles.pitchRow}>
          {line.map((p, pi) => (
            <View key={`${li}-${pi}`} style={styles.pitchPlayer}>
              <View>
                <Avatar url={p.photo} name={p.name} size={42} ring={false} />
                {badge(p) ? <Text style={styles.pitchBadge}>{badge(p)}</Text> : null}
              </View>
              <Text style={styles.pitchName} numberOfLines={1}>
                {shortName(p.name)}
              </Text>
              <Text style={styles.pitchNum}>{p.shirtNumber ?? ''}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function BenchAndSubs({
  detail,
  side,
  es,
}: {
  detail: MatchDetail;
  side: 'home' | 'away';
  es: boolean;
}) {
  const bench = (side === 'home' ? detail.home_bench : detail.away_bench) ?? [];
  const subs = detail.substitutions ?? [];
  if (!bench.length && !subs.length) return null;
  return (
    <View style={styles.benchWrap}>
      {subs.length ? (
        <>
          <Text style={styles.benchTitle}>{es ? 'Cambios' : 'Substitutions'}</Text>
          {subs.map((s, i) => (
            <Text key={i} style={styles.benchRow} numberOfLines={1}>
              <Text style={styles.subMinute}>{s.minute != null ? `${s.minute}′ ` : ''}</Text>
              ↑ {shortName(s.in_name)}  ↓ {shortName(s.out_name)}
            </Text>
          ))}
        </>
      ) : null}
      {bench.length ? (
        <>
          <Text style={styles.benchTitle}>{es ? 'Banca' : 'Bench'}</Text>
          <Text style={styles.benchRow}>
            {bench.map((p) => shortName(p.name)).join(' · ')}
          </Text>
        </>
      ) : null}
    </View>
  );
}

/** "Julián Quiñones" → "J. Quiñones" */
function shortName(name: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  scroll: { padding: 20, paddingTop: 64, paddingBottom: 140, gap: 10 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  back: { color: palette.text, fontSize: 30, fontWeight: '800', marginTop: -6 },
  ft: { color: palette.textSecondary, fontSize: 13, fontWeight: '800' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  team: { flex: 1, alignItems: 'center', gap: 6 },
  teamName: { color: palette.text, fontSize: 13, fontWeight: '800', maxWidth: 110 },
  score: {
    color: palette.text,
    fontSize: 38,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    paddingHorizontal: 8,
  },
  scoreSep: { color: palette.gold },
  venue: { color: palette.textTertiary, fontSize: 12, marginTop: 12, textAlign: 'center' },
  referee: { color: palette.textTertiary, fontSize: 11, marginTop: 4, textAlign: 'center' },
  sectionTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 4,
  },
  statTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statValue: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '900',
    width: 44,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: palette.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  statBars: { gap: 3 },
  statTrack: { flexDirection: 'row', height: 5, borderRadius: 3, overflow: 'hidden' },
  statFill: { borderRadius: 3 },
  statFillHome: { backgroundColor: palette.gold },
  statFillAway: { backgroundColor: palette.textSecondary },
  statsNote: { color: palette.textTertiary, fontSize: 12, textAlign: 'center', marginTop: 4 },
  formationRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  formationChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border,
  },
  formationChipOn: { backgroundColor: palette.goldDim, borderColor: palette.gold },
  formationText: { color: palette.textSecondary, fontSize: 13, fontWeight: '800' },
  formationTextOn: { color: palette.gold },
  pitch: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(99,153,34,0.35)',
    backgroundColor: 'rgba(99,153,34,0.10)',
    paddingVertical: 14,
    gap: 16,
  },
  pitchRow: { flexDirection: 'row', justifyContent: 'space-evenly' },
  pitchPlayer: { alignItems: 'center', width: 68 },
  pitchBadge: { position: 'absolute', right: -8, top: -4, fontSize: 12 },
  pitchName: { color: palette.text, fontSize: 10.5, fontWeight: '700', marginTop: 4 },
  pitchNum: { color: palette.textTertiary, fontSize: 10 },
  benchWrap: { marginTop: 14, gap: 4 },
  benchTitle: {
    color: palette.gold,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
  },
  benchRow: { color: palette.textSecondary, fontSize: 12, lineHeight: 18 },
  subMinute: { color: palette.gold, fontWeight: '800' },
});

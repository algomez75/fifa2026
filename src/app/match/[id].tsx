import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Countdown } from '@/components/Countdown';
import { GlassCard } from '@/components/GlassCard';
import { LiveBadge } from '@/components/LiveBadge';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/States';
import { TeamFlag } from '@/components/TeamFlag';
import { useMatchDetail, type LineupPlayer, type MatchDetail } from '@/hooks/useMatchDetail';
import { useMatchEvents } from '@/hooks/useMatchEvents';
import { useMatches } from '@/hooks/useMatches';
import { formatKickoffTime, matchDayLabel, teamName } from '@/lib/format';
import { teamsById, venuesById } from '@/lib/seed';
import { palette, radius } from '@/lib/theme';
import { useTranslation } from '@/store/useAppStore';

/** Ordered, bilingual map of football-data team statistics keys. */
const STAT_ROWS: { key: string; en: string; es: string; pct?: boolean }[] = [
  { key: 'ball_possession', en: 'Possession %', es: 'Posesión %', pct: true },
  { key: 'shots', en: 'Shots', es: 'Tiros' },
  { key: 'shots_on_goal', en: 'Shots on goal', es: 'Tiros al arco' },
  { key: 'shots_off_goal', en: 'Shots off goal', es: 'Tiros desviados' },
  { key: 'corner_kicks', en: 'Corners', es: 'Córners' },
  { key: 'fouls', en: 'Fouls', es: 'Faltas' },
  { key: 'offsides', en: 'Offsides', es: 'Fueras de juego' },
  { key: 'saves', en: 'Saves', es: 'Atajadas' },
  { key: 'free_kicks', en: 'Free kicks', es: 'Tiros libres' },
  { key: 'goal_kicks', en: 'Goal kicks', es: 'Saques de meta' },
  { key: 'throw_ins', en: 'Throw-ins', es: 'Saques de banda' },
  { key: 'yellow_cards', en: 'Yellow cards', es: 'Amarillas' },
  { key: 'red_cards', en: 'Red cards', es: 'Rojas' },
];

export default function MatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useTranslation();
  const router = useRouter();
  const { data: matches } = useMatches();
  const match = (matches ?? []).find((m) => m.id === id);
  const { data: detail } = useMatchDetail(id, {
    live: match?.status === 'live',
    finished: match?.status === 'finished',
  });
  const { data: events } = useMatchEvents();
  const [side, setSide] = useState<'home' | 'away'>('home');

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
  const scheduled = !isLive && !isFinished;

  const statsAvailable = !!(detail?.home_stats && detail?.away_stats);
  const lineupAvailable = !!(detail?.home_lineup?.length || detail?.away_lineup?.length);

  // Referee crew (main + assistants) — falls back to the single stored name.
  const refs = detail?.referees ?? [];
  const refMain = refs.find((r) => r.type === 'REFEREE') ?? refs[0] ?? null;
  const refAssistants = refs.filter(
    (r) => r !== refMain && /ASSISTANT/.test(r.type ?? ''),
  );

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
              <LiveBadge match={match} />
            ) : isFinished ? (
              <Text style={styles.ft}>{t.common.ft}</Text>
            ) : (
              <Text style={styles.kickoff}>
                {matchDayLabel(match.kickoff_utc, language, t.common.today)} ·{' '}
                {formatKickoffTime(match.kickoff_utc, language)}
              </Text>
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
            <View style={styles.scoreCol}>
              {scheduled ? (
                <Text style={styles.vsBig}>{t.common.vs}</Text>
              ) : (
                <>
                  <Text style={styles.score}>
                    {match.home_score ?? '–'}
                    <Text style={styles.scoreSep}> : </Text>
                    {match.away_score ?? '–'}
                  </Text>
                  {match.home_score_ht != null && match.away_score_ht != null ? (
                    <Text style={styles.htScore}>
                      {t.common.halfTimeShort} {match.home_score_ht}–{match.away_score_ht}
                    </Text>
                  ) : null}
                </>
              )}
            </View>
            <View style={styles.team}>
              <TeamFlag team={away} size={42} showName={false} />
              <Text style={styles.teamName} numberOfLines={1}>
                {teamName(away, language)}
              </Text>
            </View>
          </View>

          {/* Countdown to kickoff while the match hasn't started */}
          {scheduled ? (
            <View style={styles.countdownWrap}>
              <Text style={styles.countdownLabel}>{t.home.kickoffIn}</Text>
              <Countdown target={match.kickoff_utc} compact />
            </View>
          ) : null}
          {venue ? (
            <Text style={styles.venue} numberOfLines={1}>
              📍 {venue.name} · {venue.city}
              {detail?.attendance ? `  ·  👥 ${detail.attendance.toLocaleString()}` : ''}
            </Text>
          ) : null}
          {refMain ? (
            <>
              <Text style={styles.referee}>
                🟡 {refMain.name}
                {refMain.nationality ? ` · ${refMain.nationality}` : ''}
              </Text>
              {refAssistants.length ? (
                <Text style={styles.refAssistants} numberOfLines={1}>
                  {es ? 'Asistentes: ' : 'Assistants: '}
                  {refAssistants
                    .map((a) => a.name)
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              ) : null}
            </>
          ) : detail?.referee ? (
            <Text style={styles.referee}>🟡 {detail.referee}</Text>
          ) : null}
        </GlassCard>

        {/* Team stats — only once real stats are in (hidden before kickoff) */}
        {statsAvailable ? (
          <>
            <Text style={styles.sectionTitle}>{es ? 'Estadísticas' : 'Team stats'}</Text>
            <GlassCard>
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
            </GlassCard>
          </>
        ) : null}

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
      <PitchMarkings />
      <View style={styles.pitchRows}>
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
    </View>
  );
}

/** Minimalist painted field lines (Apple-Sports style): halfway line, center
 *  circle + spot, and penalty + goal areas at both ends. Sits behind players. */
function PitchMarkings() {
  return (
    <View style={styles.fieldMarks} pointerEvents="none">
      <View style={styles.fieldHalfway} />
      <View style={styles.fieldCircle} />
      <View style={styles.fieldSpot} />
      <View style={[styles.penaltyBox, styles.penaltyBoxTop]} />
      <View style={[styles.goalArea, styles.goalAreaTop]} />
      <View style={[styles.penaltyBox, styles.penaltyBoxBottom]} />
      <View style={[styles.goalArea, styles.goalAreaBottom]} />
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
  kickoff: { color: palette.gold, fontSize: 13, fontWeight: '800' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  team: { flex: 1, alignItems: 'center', gap: 6 },
  teamName: { color: palette.text, fontSize: 13, fontWeight: '800', maxWidth: 110 },
  scoreCol: { alignItems: 'center', paddingHorizontal: 8 },
  score: {
    color: palette.text,
    fontSize: 38,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  scoreSep: { color: palette.gold },
  vsBig: { color: palette.gold, fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  htScore: {
    color: palette.textTertiary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  countdownWrap: { alignItems: 'center', marginTop: 16, gap: 8 },
  countdownLabel: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  venue: { color: palette.textTertiary, fontSize: 12, marginTop: 12, textAlign: 'center' },
  referee: { color: palette.textTertiary, fontSize: 11, marginTop: 4, textAlign: 'center' },
  refAssistants: { color: palette.textTertiary, fontSize: 10, marginTop: 2, textAlign: 'center' },
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
    position: 'relative',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(99,153,34,0.35)',
    backgroundColor: 'rgba(99,153,34,0.12)',
    overflow: 'hidden',
  },
  pitchRows: { paddingVertical: 18, gap: 16 },
  pitchRow: { flexDirection: 'row', justifyContent: 'space-evenly' },
  // Minimalist field markings (semi-transparent white lines).
  fieldMarks: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fieldHalfway: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  fieldCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 88,
    height: 88,
    marginLeft: -44,
    marginTop: -44,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  fieldSpot: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 4,
    height: 4,
    marginLeft: -2,
    marginTop: -2,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  penaltyBox: {
    position: 'absolute',
    left: '18%',
    right: '18%',
    height: 60,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  penaltyBoxTop: { top: 0, borderTopWidth: 0 },
  penaltyBoxBottom: { bottom: 0, borderBottomWidth: 0 },
  goalArea: {
    position: 'absolute',
    left: '34%',
    right: '34%',
    height: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  goalAreaTop: { top: 0, borderTopWidth: 0 },
  goalAreaBottom: { bottom: 0, borderBottomWidth: 0 },
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

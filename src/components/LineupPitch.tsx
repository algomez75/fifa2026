import { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { GloveIcon } from '@/components/icons';
import type { LineupPlayer } from '@/hooks/useMatchDetail';
import { shortName } from '@/lib/format';
import { palette, radius } from '@/lib/theme';

export interface PitchEvent {
  type: string;
  player_id: number | null;
  player_name: string | null;
}

interface Props {
  lineup: LineupPlayer[];
  formation: string | null;
  events?: PitchEvent[];
}

/**
 * Vertical football pitch with the formation laid out GK-at-the-bottom,
 * attackers on top. Tall, real-pitch proportions (aspectRatio) with rows
 * distributed evenly down the field. Players show photo avatars + shirt number,
 * a goalkeeper glove, a captain mark, and goal/card badges from `events`.
 *
 * Modular — the single source of truth for lineups everywhere (live match,
 * finished/past results, and any future surface) so they all look identical.
 */
export function LineupPitch({ lineup, formation, events = [] }: Props) {
  // Sized as a fraction of the screen so the field is large and identical on
  // every surface (live, past results, …) — ~72% of the iPhone's height.
  const { height } = useWindowDimensions();
  const pitchHeight = Math.max(540, Math.round(height * 0.72));

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

  const gk = lineup[0];

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
    <View style={[styles.pitch, { height: pitchHeight }]}>
      <PitchMarkings />
      <View style={styles.pitchRows}>
        {rows.map((line, li) => (
          <View key={li} style={styles.pitchRow}>
            {line.map((p, pi) => {
              const isGK = p === gk || /goal|portero|keeper/i.test(p.position ?? '');
              return (
                <View key={`${li}-${pi}`} style={styles.pitchPlayer}>
                  <View style={styles.avatarWrap}>
                    <Avatar url={p.photo} name={p.name} size={52} ring={false} />
                    {p.shirtNumber != null ? (
                      <View style={styles.numBadge}>
                        <Text style={styles.numText}>{p.shirtNumber}</Text>
                      </View>
                    ) : null}
                    {isGK ? (
                      <View style={styles.gkBadge}>
                        <GloveIcon color={palette.gold} size={12} strokeWidth={2.2} />
                      </View>
                    ) : null}
                    {p.captain ? (
                      <View style={styles.capBadge}>
                        <Text style={styles.capText}>C</Text>
                      </View>
                    ) : null}
                    {badge(p) ? <Text style={styles.pitchBadge}>{badge(p)}</Text> : null}
                  </View>
                  <Text style={styles.pitchName} numberOfLines={1}>
                    {shortName(p.name)}
                  </Text>
                </View>
              );
            })}
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

const LINE = 'rgba(255,255,255,0.14)';

const styles = StyleSheet.create({
  // Tall field (height is set dynamically to ~72% of the screen); rows are
  // distributed evenly down the pitch.
  pitch: {
    position: 'relative',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(99,153,34,0.35)',
    backgroundColor: 'rgba(99,153,34,0.12)',
    overflow: 'hidden',
  },
  pitchRows: { flex: 1, paddingVertical: 28, justifyContent: 'space-between' },
  pitchRow: { flexDirection: 'row', justifyContent: 'space-evenly' },
  fieldMarks: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fieldHalfway: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: LINE,
  },
  fieldCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 128,
    height: 128,
    marginLeft: -64,
    marginTop: -64,
    borderRadius: 64,
    borderWidth: 1,
    borderColor: LINE,
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
    left: '17%',
    right: '17%',
    height: 88,
    borderWidth: 1,
    borderColor: LINE,
  },
  penaltyBoxTop: { top: 0, borderTopWidth: 0 },
  penaltyBoxBottom: { bottom: 0, borderBottomWidth: 0 },
  goalArea: {
    position: 'absolute',
    left: '33%',
    right: '33%',
    height: 38,
    borderWidth: 1,
    borderColor: LINE,
  },
  goalAreaTop: { top: 0, borderTopWidth: 0 },
  goalAreaBottom: { bottom: 0, borderBottomWidth: 0 },
  pitchPlayer: { alignItems: 'center', width: 62 },
  avatarWrap: { position: 'relative' },
  pitchBadge: { position: 'absolute', right: -8, top: -4, fontSize: 12 },
  numBadge: {
    position: 'absolute',
    right: -5,
    bottom: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    borderRadius: 9,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.border2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: {
    color: palette.text,
    fontSize: 10,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  gkBadge: {
    position: 'absolute',
    left: -5,
    top: -4,
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.goldDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capBadge: {
    position: 'absolute',
    left: -5,
    bottom: -4,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: palette.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capText: { color: palette.bg, fontSize: 10, fontWeight: '900' },
  pitchName: { color: palette.text, fontSize: 10.5, fontWeight: '700', marginTop: 6 },
});

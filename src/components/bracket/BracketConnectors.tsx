import { StyleSheet } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';

import { palette } from '@/lib/theme';

import type { CellPos } from './layout';

const LINE = 1.5;

interface Props {
  cells: Map<string, CellPos>;
  /** matchId → vertical center per snap anchor (see bracketAnchorLayouts). */
  tracks: Map<string, number[]>;
  /** Horizontal snap offsets — the interpolation input range. */
  xs: number[];
  scrollX: SharedValue<number>;
  colW: number;
  cellW: number;
  vPad: number;
}

/**
 * Orthogonal bracket connectors: for every parent match, a horizontal stub out
 * of each feeder, a vertical bar joining the pair, and a horizontal stub into
 * the parent. Absolute Views (cheaper than SVG, exact geometry) whose vertical
 * position/extent morphs with the horizontal scroll, in lockstep with the
 * cells' fit-to-screen layout. Rendered behind the cells.
 */
export function BracketConnectors({ cells, tracks, xs, scrollX, colW, cellW, vPad }: Props) {
  const nodes: React.ReactNode[] = [];

  for (const [id, pos] of cells) {
    if (!pos.feeders) continue;
    const [aId, bId] = pos.feeders; // [top, bottom] feeder at every anchor
    const ta = tracks.get(aId);
    const tb = tracks.get(bId);
    const tp = tracks.get(id);
    if (!ta || !tb || !tp) continue;

    const childRightX = (pos.col - 1) * colW + cellW;
    const parentLeftX = pos.col * colW;
    const midX = (childRightX + parentLeftX) / 2;
    const stubW = midX - childRightX;

    nodes.push(
      // stub out of each feeder → midX
      <HSeg key={`${id}a`} left={childRightX} width={stubW} xs={xs} scrollX={scrollX}
        tops={ta.map((v) => v + vPad - LINE / 2)} />,
      <HSeg key={`${id}b`} left={childRightX} width={stubW} xs={xs} scrollX={scrollX}
        tops={tb.map((v) => v + vPad - LINE / 2)} />,
      // vertical bar joining the two feeders
      <VSeg key={`${id}v`} left={midX - LINE / 2} xs={xs} scrollX={scrollX}
        tops={ta.map((v) => v + vPad)}
        spans={ta.map((v, i) => Math.max(tb[i] - v, LINE))} />,
      // stub from the bar's midpoint → parent
      <HSeg key={`${id}p`} left={midX} width={parentLeftX - midX} xs={xs} scrollX={scrollX}
        tops={tp.map((v) => v + vPad - LINE / 2)} />,
    );
  }

  return <>{nodes}</>;
}

function HSeg({
  left,
  width,
  tops,
  xs,
  scrollX,
}: {
  left: number;
  width: number;
  tops: number[];
  xs: number[];
  scrollX: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(scrollX.value, xs, tops, Extrapolation.CLAMP) },
    ],
  }));
  return <Animated.View style={[styles.seg, { left, width, height: LINE }, style]} />;
}

function VSeg({
  left,
  tops,
  spans,
  xs,
  scrollX,
}: {
  left: number;
  tops: number[];
  spans: number[];
  xs: number[];
  scrollX: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    height: interpolate(scrollX.value, xs, spans, Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollX.value, xs, tops, Extrapolation.CLAMP) },
    ],
  }));
  return <Animated.View style={[styles.seg, { left, width: LINE }, style]} />;
}

const styles = StyleSheet.create({
  seg: {
    position: 'absolute',
    top: 0,
    backgroundColor: palette.border2,
    borderRadius: LINE / 2,
  },
});

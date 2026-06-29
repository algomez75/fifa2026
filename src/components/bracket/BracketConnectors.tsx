import { View } from 'react-native';

import { palette } from '@/lib/theme';

import type { CellPos } from './layout';

const LINE = 1.5;

/**
 * Orthogonal bracket connectors: for every parent match, a horizontal stub out
 * of each feeder, a vertical bar joining the pair, and a horizontal stub into
 * the parent. Plain absolute Views (cheaper than SVG, exact geometry). Rendered
 * behind the cells.
 */
export function BracketConnectors({
  cells,
  colW,
  cellW,
  vPad,
}: {
  cells: Map<string, CellPos>;
  colW: number;
  cellW: number;
  vPad: number;
}) {
  const segs: { left: number; top: number; width: number; height: number }[] = [];

  for (const [, pos] of cells) {
    if (!pos.feeders) continue;
    const [aId, bId] = pos.feeders;
    const a = cells.get(aId);
    const b = cells.get(bId);
    if (!a || !b) continue;

    const childRightX = (pos.col - 1) * colW + cellW;
    const parentLeftX = pos.col * colW;
    const midX = (childRightX + parentLeftX) / 2;
    const cyA = a.cy + vPad;
    const cyB = b.cy + vPad;
    const cyP = pos.cy + vPad;
    const top = Math.min(cyA, cyB);
    const bot = Math.max(cyA, cyB);

    // stub out of each feeder → midX
    segs.push({ left: childRightX, top: cyA - LINE / 2, width: midX - childRightX, height: LINE });
    segs.push({ left: childRightX, top: cyB - LINE / 2, width: midX - childRightX, height: LINE });
    // vertical bar joining the two feeders
    segs.push({ left: midX - LINE / 2, top, width: LINE, height: bot - top });
    // stub from the bar's midpoint → parent
    segs.push({ left: midX, top: cyP - LINE / 2, width: parentLeftX - midX, height: LINE });
  }

  return (
    <>
      {segs.map((s, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: s.left,
            top: s.top,
            width: s.width,
            height: s.height,
            backgroundColor: palette.border2,
            borderRadius: LINE / 2,
          }}
        />
      ))}
    </>
  );
}

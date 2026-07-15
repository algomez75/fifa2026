/**
 * Pure geometry for the knockout bracket TREE. Each match is placed so it sits
 * vertically centered between the two matches that feed it (Apple-Sports style),
 * derived from the real WC26 feeding graph. Column index 0 is the Group-Stage
 * column; 1=R32, 2=R16, 3=QF, 4=SF, 5=Final (+ a separate 3rd-place box).
 */

export const CELL_H = 74; // date header + 2 team rows (compact, fixed)
export const CELL_GAP = 12; // vertical gap between adjacent R32 leaf cells
export const COL_GAP = 22; // horizontal gutter between columns (connector room)
export const H_PAD = 16; // horizontal padding inside the scroll content
export const V_PAD = 14; // vertical padding at the top of the canvas
export const ROW = CELL_H + CELL_GAP; // vertical pitch of the R32 leaf column

/** Column index per stage. GS=0 is rendered as stacked group tables. */
export const COL = { group: 0, r32: 1, r16: 2, qf: 3, sf: 4, final: 5 } as const;
export const NUM_COLS = 6;

/**
 * R32 leaf order, top→bottom, that makes the tree planar (no crossing
 * connectors). It's a DFS from the Final through the feeding graph; verified to
 * match the Apple-Sports reference exactly (Germany=R32-2 on top, then France,
 * SA/Canada, Netherlands, Portugal, Spain, USA…).
 */
export const R32_ORDER = [2, 5, 1, 3, 11, 12, 9, 10, 4, 6, 7, 8, 14, 16, 13, 15];

/** parent matchId → its two feeder matchIds. Children listed before parents so a
 *  single forward pass can resolve every center. (3RD-1 is off-tree.) */
export const FEED: [string, [string, string]][] = [
  ['R16-1', ['R32-2', 'R32-5']],
  ['R16-2', ['R32-1', 'R32-3']],
  ['R16-3', ['R32-4', 'R32-6']],
  ['R16-4', ['R32-7', 'R32-8']],
  ['R16-5', ['R32-11', 'R32-12']],
  ['R16-6', ['R32-9', 'R32-10']],
  ['R16-7', ['R32-14', 'R32-16']],
  ['R16-8', ['R32-13', 'R32-15']],
  ['QF-1', ['R16-1', 'R16-2']],
  ['QF-2', ['R16-5', 'R16-6']],
  ['QF-3', ['R16-3', 'R16-4']],
  ['QF-4', ['R16-7', 'R16-8']],
  ['SF-1', ['QF-1', 'QF-2']],
  ['SF-2', ['QF-3', 'QF-4']],
  ['FINAL-1', ['SF-1', 'SF-2']],
];

const COL_OF: Record<string, number> = {
  R32: COL.r32,
  R16: COL.r16,
  QF: COL.qf,
  SF: COL.sf,
  FINAL: COL.final,
};

export interface CellPos {
  col: number;
  /** Vertical center (px) within the canvas, before V_PAD. */
  cy: number;
  /** Feeder matchIds (absent for the R32 leaves). */
  feeders?: [string, string];
}

export interface BracketLayout {
  cells: Map<string, CellPos>;
  /** Height (px) of the tallest knockout column (R32). */
  knockoutHeight: number;
}

/** Build the matchId → {col, cy} map. Pure & deterministic. */
export function bracketLayout(): BracketLayout {
  const cy = new Map<string, number>();
  // R32 leaves: evenly spaced in DFS order.
  R32_ORDER.forEach((n, k) => cy.set(`R32-${n}`, k * ROW + CELL_H / 2));
  // Every parent = midpoint of its two feeders (forward pass).
  for (const [id, [a, b]] of FEED) cy.set(id, (cy.get(a)! + cy.get(b)!) / 2);

  const cells = new Map<string, CellPos>();
  R32_ORDER.forEach((n) => cells.set(`R32-${n}`, { col: COL.r32, cy: cy.get(`R32-${n}`)! }));
  for (const [id, feeders] of FEED)
    cells.set(id, { col: COL_OF[id.split('-')[0]] ?? COL.final, cy: cy.get(id)!, feeders });

  return { cells, knockoutHeight: R32_ORDER.length * ROW };
}

/** Number of horizontal snap anchors (GS+R32 · R32+R16 · R16+QF · QF+SF · SF+F). */
export const SNAP_COUNT = 5;
/** Gap between the Final cell and the 3rd-place box (px). */
export const THIRD_GAP = 44;
/** 3rd-place box title height incl. margin (px) — used for canvas extents. */
export const THIRD_TITLE_H = 22;

export interface AnchorLayouts {
  /** matchId → vertical center (px, before V_PAD) at each snap anchor 0..4. */
  tracks: Map<string, number[]>;
  /** Full canvas height (px, incl. V_PAD × 2) at each snap anchor. */
  heights: number[];
}

/**
 * Fit-to-screen morph geometry: one layout per horizontal snap anchor. At each
 * anchor the leftmost visible knockout round spreads its matches evenly across
 * the visible height (`fitH`) when they fit — else it keeps the natural compact
 * pitch and the canvas stays vertically scrollable. Later rounds sit at their
 * feeders' midpoints; already-passed rounds tuck each pair in around the match
 * it feeds (midpoint invariant kept, so connectors stay clean elbows while the
 * cells interpolate between anchors with the horizontal scroll).
 */
export function bracketAnchorLayouts(fitH: number, groupsH: number): AnchorLayouts {
  const base = bracketLayout();

  // Knockout column ids in tree (top→bottom) order; index 0 = R32 … 4 = Final.
  const colIds: string[][] = Array.from({ length: 5 }, () => []);
  for (const [id, pos] of base.cells) colIds[pos.col - 1].push(id);
  for (const ids of colIds)
    ids.sort((x, y) => base.cells.get(x)!.cy - base.cells.get(y)!.cy);

  const tracks = new Map<string, number[]>();
  for (const id of base.cells.keys()) tracks.set(id, []);
  const heights: number[] = [];

  // Leftmost visible knockout column per anchor (anchor 0 shows GS + R32).
  const ANCHOR_COL = [1, 1, 2, 3, 4];

  for (let a = 0; a < SNAP_COUNT; a++) {
    const cy = new Map<string, number>();
    const anchorCol = ANCHOR_COL[a];
    const ids = colIds[anchorCol - 1];
    const n = ids.length;
    const fits = n * ROW <= fitH;
    const span = fits ? fitH : n * ROW;
    const pitch = fits ? fitH / n : ROW;
    ids.forEach((id, i) =>
      cy.set(id, fits ? pitch * (i + 0.5) : i * ROW + CELL_H / 2),
    );

    // Later rounds: each match at the midpoint of its two feeders.
    for (let c = anchorCol + 1; c <= 5; c++) {
      for (const id of colIds[c - 1]) {
        const f = base.cells.get(id)!.feeders!;
        cy.set(id, (cy.get(f[0])! + cy.get(f[1])!) / 2);
      }
    }

    // Passed rounds: each feeder pair tucks in around the match it feeds
    // (separation halves per step back so exiting columns visibly regroup).
    // Clamped inside the canvas; the tiny midpoint bend (≤ sep/4) keeps the
    // parent stub within the connector bar, so elbows still read connected.
    let sep = pitch / 2;
    for (let c = anchorCol - 1; c >= 1; c--) {
      for (const id of colIds[c]) {
        // parents live in column c+1 (= colIds[c]); their feeders in column c
        const f = base.cells.get(id)!.feeders!;
        const p = cy.get(id)!;
        const clamp = (v: number) =>
          Math.min(Math.max(v, CELL_H / 2), span - CELL_H / 2);
        cy.set(f[0], clamp(p - sep / 2));
        cy.set(f[1], clamp(p + sep / 2));
      }
      sep = Math.max(8, sep / 2);
    }

    for (const [id, arr] of tracks) arr.push(cy.get(id)!);

    // Canvas extent: the spread span, the 3rd-place box below the Final, and
    // (anchor 0 only) the group-standings column.
    const thirdBottom =
      cy.get('FINAL-1')! + CELL_H / 2 + THIRD_GAP + THIRD_TITLE_H + CELL_H;
    const ko = Math.max(span, thirdBottom);
    heights.push((a === 0 ? Math.max(ko, groupsH) : ko) + V_PAD * 2);
  }

  return { tracks, heights };
}

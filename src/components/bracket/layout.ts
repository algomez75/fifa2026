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

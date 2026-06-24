import type { StandingRow } from './standings';

/** Each team plays 3 group matches. */
const GROUP_GAMES_PER_TEAM = 3;

/**
 * Parse a knockout placeholder that references a GROUP position.
 *  - "Winner A"    → { pos: 1, group: 'A' }
 *  - "Runner-up B" → { pos: 2, group: 'B' }
 * Returns null for best-third ("3rd A/B/C/D/F") and later-round
 * ("Winner R32-1", "Loser SF-1") references, which the group standings can't
 * resolve — those stay TBD until the server decides them.
 */
export function parseGroupSlot(
  placeholder: string | null | undefined,
): { pos: 1 | 2; group: string } | null {
  if (!placeholder) return null;
  const w = /^Winner ([A-L])$/.exec(placeholder);
  if (w) return { pos: 1, group: w[1] };
  const r = /^Runner-up ([A-L])$/.exec(placeholder);
  if (r) return { pos: 2, group: r[1] };
  return null;
}

/** Most points a team can still reach if it wins all its remaining group games. */
const maxReachablePts = (r: StandingRow) =>
  r.points + 3 * Math.max(0, GROUP_GAMES_PER_TEAM - r.played);

/**
 * Decide which teams are SECURELY through to 1st / 2nd of a group — the ones
 * Apple-Sports-style fills into the bracket in real time.
 *
 * `rows` must be ordered (current leader first). When the group is fully played
 * the order is authoritative (1st / 2nd are final). While it's still in progress
 * a slot is only resolved once it's **mathematically clinched**, so a team that
 * could still be overtaken is never shown:
 *   - **1st** — no other team can even MATCH the leader's current points
 *     (a team that could only draw level is treated as a threat, so a tie that
 *     a tiebreaker might lose never resolves early).
 *   - **2nd** — 1st is already clinched by some team AND at most one team (that
 *     leader) can finish above this one, so it's locked into 2nd.
 *
 * Conservative on ties → may resolve a touch late, but never wrongly.
 */
export function resolveGroupSlots(
  rows: StandingRow[],
  finished: boolean,
): { first: string | null; second: string | null } {
  if (rows.length < 2) return { first: null, second: null };
  if (finished) return { first: rows[0].teamId, second: rows[1].teamId };

  // How many OTHER teams can still finish at or above team `t`'s current points.
  const threatsTo = (t: StandingRow) =>
    rows.filter((o) => o.teamId !== t.teamId && maxReachablePts(o) >= t.points).length;

  const leader = rows[0];
  const first = threatsTo(leader) === 0 ? leader.teamId : null;

  let second: string | null = null;
  if (first) {
    // With 1st locked, a team whose ONLY possible superior is that leader is
    // mathematically pinned to 2nd. (At most one team can satisfy this.)
    for (const t of rows) {
      if (t.teamId === first) continue;
      if (threatsTo(t) <= 1) {
        second = t.teamId;
        break;
      }
    }
  }

  return { first, second };
}

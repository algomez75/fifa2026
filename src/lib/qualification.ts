import type { Match } from './database.types';
import type { StandingRow } from './standings';

/** A knockout side resolved through the live bracket-qualifier map. */
export interface ResolvedSide {
  /** Server-set team id if decided, else the real-time qualified team, else null. */
  teamId: string | null;
  /** True only when an undecided side was filled by a (provisional) qualifier. */
  isQualified: boolean;
  /** True when that qualifier's exact seed (1st/2nd) is mathematically fixed. */
  isLocked: boolean;
}

export interface ResolvedMatch {
  home: ResolvedSide;
  away: ResolvedSide;
}

/** Minimal qualifier-map shape (structurally `Map<string, BracketSlot>`). */
type QualifierMap = Map<string, { teamId: string; locked: boolean }>;

function resolveSide(
  serverId: string | null,
  placeholder: string | null,
  qualifiers: QualifierMap,
): ResolvedSide {
  const slot = !serverId && placeholder ? qualifiers.get(placeholder) ?? null : null;
  const qualifiedId = slot?.teamId ?? null;
  const isQualified = !serverId && !!qualifiedId;
  return { teamId: serverId ?? qualifiedId, isQualified, isLocked: isQualified && !!slot?.locked };
}

/**
 * Resolve a knockout match's two sides through the bracket-qualifier map: a
 * server-set team id always wins; otherwise an undecided side is filled with its
 * real-time mathematically-qualified team (best-third / later-round placeholders
 * stay null → TBD). Shared by the Bracket and the Schedule so both surfaces fill
 * R32 slots identically. Pure — receives the already-built qualifier map.
 */
export function resolveMatchTeams(
  match: Pick<Match, 'home_team_id' | 'away_team_id' | 'home_placeholder' | 'away_placeholder'>,
  qualifiers: QualifierMap,
): ResolvedMatch {
  return {
    home: resolveSide(match.home_team_id, match.home_placeholder, qualifiers),
    away: resolveSide(match.away_team_id, match.away_placeholder, qualifiers),
  };
}

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

export interface GroupQualifier {
  teamId: string;
  /** Guaranteed top-2 (advances) in EVERY possible remaining-result scenario. */
  advances: boolean;
  /** Guaranteed to finish 1st (winner) in every scenario. */
  lockedFirst: boolean;
  /** Guaranteed to finish 2nd (runner-up) in every scenario. */
  lockedSecond: boolean;
}

export interface GroupQualifierResult {
  rows: StandingRow[];
  byTeam: Map<string, GroupQualifier>;
}

/**
 * Decide which teams are MATHEMATICALLY through to the knockouts — the ones
 * Apple-Sports-style fills into the bracket in real time.
 *
 * `orderedRows` is the current standings (leader first). When the group is fully
 * played the order is authoritative. While it's in progress we **enumerate every
 * possible outcome of the remaining group fixtures** (home win / draw / away win
 * → +3 / +1+1 / +3) and only mark a team `advances` if it lands top-2 in EVERY
 * one of them. Crucially this honours the fixture graph — two of a leader's
 * chasers that play EACH OTHER can never both catch it (a naive points bound
 * misses this and is overly cautious).
 *
 * Ranking inside a scenario is by POINTS ONLY, treating an equal-points pair as
 * AMBIGUOUS (a tie that GD / head-to-head / fair-play could break either way).
 * So a team is only `advances` when it's top-2 regardless of any tiebreaker →
 * the bracket can never show a team that isn't truly through. (The trade-off: a
 * team that's safe only on goal difference resolves a touch late — never wrongly.)
 *
 * `n = remaining` is ≤ 6 per group → ≤ 729 scenarios, trivial.
 */
export function resolveGroupQualifiers(
  orderedRows: StandingRow[],
  groupMatches: Match[],
): GroupQualifierResult {
  const teamIds = orderedRows.map((r) => r.teamId);
  const byTeam = new Map<string, GroupQualifier>();

  const finished =
    groupMatches.length > 0 && groupMatches.every((m) => m.status === 'finished');
  if (finished) {
    // Order is authoritative (official GD/H2H already broke any tie). The
    // points-only enumeration below would wrongly drop a tied runner-up, so this
    // branch is mandatory.
    orderedRows.forEach((r, i) =>
      byTeam.set(r.teamId, {
        teamId: r.teamId,
        advances: i < 2,
        lockedFirst: i === 0,
        lockedSecond: i === 1,
      }),
    );
    return { rows: orderedRows, byTeam };
  }

  // Base points from FINISHED matches only — self-contained, never drifts if a
  // standings provider's points lag the local match list.
  const base = new Map<string, number>(teamIds.map((id) => [id, 0]));
  for (const m of groupMatches) {
    if (m.status !== 'finished') continue;
    if (m.home_score == null || m.away_score == null) continue;
    if (!m.home_team_id || !m.away_team_id) continue;
    if (!base.has(m.home_team_id) || !base.has(m.away_team_id)) continue;
    if (m.home_score > m.away_score) base.set(m.home_team_id, base.get(m.home_team_id)! + 3);
    else if (m.home_score < m.away_score) base.set(m.away_team_id, base.get(m.away_team_id)! + 3);
    else {
      base.set(m.home_team_id, base.get(m.home_team_id)! + 1);
      base.set(m.away_team_id, base.get(m.away_team_id)! + 1);
    }
  }

  // Remaining fixtures (a `live` match is not `finished` → enumerated, since its
  // score can still change). Skip any with a missing/unknown team id.
  const remaining: [string, string][] = [];
  for (const m of groupMatches) {
    if (m.status === 'finished') continue;
    const h = m.home_team_id;
    const a = m.away_team_id;
    if (!h || !a || !base.has(h) || !base.has(a)) continue;
    remaining.push([h, a]);
  }

  // Start optimistic, AND-reduce across every scenario.
  for (const id of teamIds)
    byTeam.set(id, { teamId: id, advances: true, lockedFirst: true, lockedSecond: true });

  const n = remaining.length;
  const total = 3 ** n;
  for (let scenario = 0; scenario < total; scenario++) {
    const pts = new Map(base);
    let code = scenario;
    for (let i = 0; i < n; i++) {
      const outcome = code % 3;
      code = Math.floor(code / 3);
      const [h, a] = remaining[i];
      if (outcome === 0) pts.set(h, pts.get(h)! + 3); // home win
      else if (outcome === 1) {
        pts.set(h, pts.get(h)! + 1); // draw
        pts.set(a, pts.get(a)! + 1);
      } else pts.set(a, pts.get(a)! + 3); // away win
    }

    for (const id of teamIds) {
      const p = pts.get(id)!;
      let strictlyAbove = 0;
      let tied = 0;
      for (const other of teamIds) {
        if (other === id) continue;
        const op = pts.get(other)!;
        if (op > p) strictlyAbove++;
        else if (op === p) tied++;
      }
      const agg = byTeam.get(id)!;
      agg.advances = agg.advances && 1 + strictlyAbove + tied <= 2;
      agg.lockedFirst = agg.lockedFirst && strictlyAbove === 0 && tied === 0;
      agg.lockedSecond = agg.lockedSecond && strictlyAbove === 1 && tied === 0;
    }
  }

  return { rows: orderedRows, byTeam };
}

import type { Match } from './database.types';
import type { StandingRow } from './standings';

/** A knockout side resolved through the live bracket-qualifier map. */
export interface ResolvedSide {
  /** Server-set id if decided, else the real-time qualified/advancing team, else null. */
  teamId: string | null;
  /** True only when an undecided side was filled by a (provisional) GROUP qualifier. */
  isQualified: boolean;
  /** True when that group qualifier's exact seed (1st/2nd) is mathematically fixed. */
  isLocked: boolean;
  /** True when the side is concretely decided: a server-set id, or the winner/
   *  loser of an already-FINISHED feeder match (knockout progression). */
  confirmed: boolean;
}

export interface ResolvedMatch {
  home: ResolvedSide;
  away: ResolvedSide;
}

/** Minimal qualifier-map shape (structurally `Map<string, BracketSlot>`). */
type QualifierMap = Map<string, { teamId: string; locked: boolean }>;

/** Fields needed to decide a knockout match's winner/loser. */
export type ResultMatch = Pick<
  Match,
  | 'home_team_id'
  | 'away_team_id'
  | 'home_score'
  | 'away_score'
  | 'home_score_penalties'
  | 'away_score_penalties'
  | 'status'
>;
/** All matches keyed by id — lets the resolver advance a finished feeder's
 *  winner/loser into the next round client-side. */
export type MatchById = ReadonlyMap<string, ResultMatch>;

function resolveSide(
  serverId: string | null,
  placeholder: string | null,
  qualifiers: QualifierMap,
  byId?: MatchById,
): ResolvedSide {
  // 1. The server (football-data) wrote the real team id → authoritative.
  if (serverId) return { teamId: serverId, isQualified: false, isLocked: false, confirmed: true };
  // 2. A mathematically-qualified GROUP team fills an R32 slot (provisional/locked).
  const slot = placeholder ? qualifiers.get(placeholder) ?? null : null;
  if (slot)
    return { teamId: slot.teamId, isQualified: true, isLocked: !!slot.locked, confirmed: false };
  // 3. Knockout progression: the winner/loser of an already-finished feeder match
  //    (e.g. "Winner R32-1" → Canada the moment R32-1 ends), even before the server syncs.
  const prog = parseProgressionSlot(placeholder);
  if (prog && byId) {
    const feeder = byId.get(prog.ref);
    const teamId = feeder ? (prog.kind === 'winner' ? winnerOf(feeder) : loserOf(feeder)) : null;
    if (teamId) return { teamId, isQualified: false, isLocked: false, confirmed: true };
  }
  // 4. Undecided → TBD.
  return { teamId: null, isQualified: false, isLocked: false, confirmed: false };
}

/**
 * Resolve a knockout match's two sides: a server-set team id wins; else a
 * real-time mathematically-qualified GROUP team (R32 slots); else the
 * winner/loser of a finished feeder match (R16+ progression, when `byId` is
 * given); else null → TBD. Shared by the Bracket and the Schedule so every
 * surface fills slots identically. Pure.
 */
export function resolveMatchTeams(
  match: Pick<Match, 'home_team_id' | 'away_team_id' | 'home_placeholder' | 'away_placeholder'>,
  qualifiers: QualifierMap,
  byId?: MatchById,
): ResolvedMatch {
  return {
    home: resolveSide(match.home_team_id, match.home_placeholder, qualifiers, byId),
    away: resolveSide(match.away_team_id, match.away_placeholder, qualifiers, byId),
  };
}

/** Resolve every knockout match (server id → group clinch → finished-feeder
 *  progression). Returns matchId → resolved sides. Pure.
 *
 *  Iterates to a fixed point so progression propagates THROUGH the rounds: when
 *  an intermediate match (e.g. an R16) is finished but its own team ids haven't
 *  been server-written yet, its winner — resolved from its feeders — is fed
 *  forward so the next round (QF…) advances too. Only `confirmed` ids (server-set
 *  or a finished-feeder winner/loser) are propagated; a provisional group clinch
 *  is never written into a later round. Converges in ≤ bracket-depth passes. */
export function resolveBracket(
  matches: Match[],
  qualifiers: QualifierMap,
): Map<string, ResolvedMatch> {
  // Working copy whose knockout team ids get filled in as feeders resolve.
  const work = new Map<string, Match>(matches.map((m) => [m.id, { ...m }]));
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 8) {
    changed = false;
    for (const m of matches) {
      if (m.stage === 'group') continue;
      const cur = work.get(m.id)!;
      const r = resolveMatchTeams(cur, qualifiers, work);
      const nextHome = r.home.confirmed ? r.home.teamId : cur.home_team_id;
      const nextAway = r.away.confirmed ? r.away.teamId : cur.away_team_id;
      if (nextHome !== cur.home_team_id || nextAway !== cur.away_team_id) {
        work.set(m.id, { ...cur, home_team_id: nextHome, away_team_id: nextAway });
        changed = true;
      }
    }
  }

  const out = new Map<string, ResolvedMatch>();
  for (const m of matches) {
    if (m.stage === 'group') continue;
    out.set(m.id, resolveMatchTeams(work.get(m.id)!, qualifiers, work));
  }
  return out;
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

/**
 * Parse a knockout placeholder that references a prior MATCH (not a group slot):
 *   "Winner R32-2" → { ref: 'R32-2', kind: 'winner' }
 *   "Loser SF-1"   → { ref: 'SF-1',  kind: 'loser'  }
 * Returns null for group slots ("Winner A") and anything else.
 */
export function parseProgressionSlot(
  placeholder: string | null | undefined,
): { ref: string; kind: 'winner' | 'loser' } | null {
  if (!placeholder) return null;
  const m = /^(Winner|Loser) ((?:R32|R16|QF|SF|3RD|FINAL)-\d+)$/.exec(placeholder);
  if (!m) return null;
  return { ref: m[2], kind: m[1] === 'Winner' ? 'winner' : 'loser' };
}

/** Which side won a FINISHED match (regulation/extra-time score, then the
 *  penalty shootout); null if not finished, scores missing, or still level. */
export function winningSide(m: ResultMatch): 'home' | 'away' | null {
  if (m.status !== 'finished') return null;
  const hs = m.home_score;
  const as = m.away_score;
  if (hs == null || as == null) return null;
  if (hs > as) return 'home';
  if (hs < as) return 'away';
  const hp = m.home_score_penalties;
  const ap = m.away_score_penalties;
  if (hp == null || ap == null || hp === ap) return null;
  return hp > ap ? 'home' : 'away';
}

/** Team id of the winner of a finished match (null if undecided). */
export function winnerOf(m: ResultMatch): string | null {
  const s = winningSide(m);
  if (!s) return null;
  return (s === 'home' ? m.home_team_id : m.away_team_id) ?? null;
}

/** Team id of the loser of a finished match (null if undecided). */
export function loserOf(m: ResultMatch): string | null {
  const s = winningSide(m);
  if (!s) return null;
  return (s === 'home' ? m.away_team_id : m.home_team_id) ?? null;
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

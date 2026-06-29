/**
 * Scenario tests for the bracket qualifier logic (run: `npx tsx
 * scripts/qualification.test.ts`). `scripts` is excluded from the `@/*` alias,
 * so import via relative paths. Reproduces the REAL group-stage state and
 * asserts exactly {mex,usa,ger,arg,fra,nor} have clinched advancement, none with
 * a locked seed yet — plus a few edge units. Exits non-zero on any failure.
 */
import type { Match, MatchStatus, Stage } from '../src/lib/database.types';
import {
  loserOf,
  parseGroupSlot,
  parseProgressionSlot,
  resolveBracket,
  resolveGroupQualifiers,
  winnerOf,
  winningSide,
} from '../src/lib/qualification';
import { computeStandings, reconcileStandings, type StandingRow } from '../src/lib/standings';

let seq = 0;
function mkMatch(p: Partial<Match>): Match {
  return {
    id: `M${seq++}`,
    stage: 'group' as Stage,
    group_letter: null,
    match_number: null,
    home_team_id: null,
    away_team_id: null,
    home_placeholder: null,
    away_placeholder: null,
    home_score: null,
    away_score: null,
    home_score_penalties: null,
    away_score_penalties: null,
    status: 'scheduled' as MatchStatus,
    kickoff_utc: '2026-06-20T00:00:00Z',
    venue_id: null,
    api_football_fixture_id: null,
    minute: null,
    updated_at: '2026-06-20T00:00:00Z',
    ...p,
  };
}

const pairKey = (a: string, b: string) => [a, b].sort().join('|');

/**
 * Build a group's matches that reproduce the given target points: brute-force a
 * win/draw/loss assignment for the finished pairings (those not in `remaining`)
 * that hits each team's total, then add the remaining pairs as `scheduled`. The
 * algorithm ignores GD, so any valid assignment yields identical results.
 */
function makeGroup(
  letter: string,
  pts: Record<string, number>,
  remaining: [string, string][],
): Match[] {
  const teams = Object.keys(pts);
  const allPairs: [string, string][] = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++) allPairs.push([teams[i], teams[j]]);
  const remSet = new Set(remaining.map(([a, b]) => pairKey(a, b)));
  const finishedPairs = allPairs.filter(([a, b]) => !remSet.has(pairKey(a, b)));

  const F = finishedPairs.length;
  let chosen: number[] | null = null;
  for (let mask = 0; mask < 3 ** F && !chosen; mask++) {
    const got: Record<string, number> = Object.fromEntries(teams.map((t) => [t, 0]));
    let code = mask;
    for (let i = 0; i < F; i++) {
      const o = code % 3;
      code = Math.floor(code / 3);
      const [h, a] = finishedPairs[i];
      if (o === 0) got[h] += 3;
      else if (o === 1) { got[h]++; got[a]++; }
      else got[a] += 3;
    }
    if (teams.every((t) => got[t] === pts[t])) {
      chosen = [];
      let c2 = mask;
      for (let i = 0; i < F; i++) { chosen.push(c2 % 3); c2 = Math.floor(c2 / 3); }
    }
  }
  if (!chosen) throw new Error(`group ${letter}: no result assignment reproduces ${JSON.stringify(pts)}`);

  const matches: Match[] = finishedPairs.map(([h, a], i) => {
    const o = chosen![i];
    const [hs, as] = o === 0 ? [1, 0] : o === 1 ? [0, 0] : [0, 1];
    return mkMatch({
      group_letter: letter,
      status: 'finished',
      home_team_id: h,
      away_team_id: a,
      home_score: hs,
      away_score: as,
    });
  });
  for (const [h, a] of remaining)
    matches.push(
      mkMatch({ group_letter: letter, status: 'scheduled', home_team_id: h, away_team_id: a }),
    );
  return matches;
}

let failures = 0;
const assert = (cond: boolean, msg: string) => {
  if (cond) console.log('  PASS:', msg);
  else { console.error('  FAIL:', msg); failures++; }
};

// ── Real current group state: 2 played / 1 remaining per team ────────────────
const GROUPS: { letter: string; pts: Record<string, number>; remaining: [string, string][] }[] = [
  { letter: 'A', pts: { mex: 6, kor: 3, cze: 1, rsa: 1 }, remaining: [['cze', 'mex'], ['rsa', 'kor']] },
  { letter: 'B', pts: { can: 4, sui: 4, bih: 1, qat: 1 }, remaining: [['sui', 'can'], ['bih', 'qat']] },
  { letter: 'C', pts: { bra: 4, mar: 4, sco: 3, hai: 0 }, remaining: [['sco', 'bra'], ['mar', 'hai']] },
  { letter: 'D', pts: { usa: 6, aus: 3, par: 3, tur: 0 }, remaining: [['tur', 'usa'], ['par', 'aus']] },
  { letter: 'E', pts: { ger: 6, civ: 3, ecu: 1, cuw: 1 }, remaining: [['cuw', 'civ'], ['ecu', 'ger']] },
  { letter: 'F', pts: { ned: 4, jpn: 4, swe: 3, tun: 0 }, remaining: [['jpn', 'swe'], ['tun', 'ned']] },
  { letter: 'G', pts: { egy: 4, irn: 2, bel: 2, nzl: 1 }, remaining: [['egy', 'irn'], ['nzl', 'bel']] },
  { letter: 'H', pts: { esp: 4, uru: 2, cpv: 2, ksa: 1 }, remaining: [['cpv', 'ksa'], ['uru', 'esp']] },
  { letter: 'I', pts: { fra: 6, nor: 6, sen: 0, irq: 0 }, remaining: [['nor', 'fra'], ['sen', 'irq']] },
  { letter: 'J', pts: { arg: 6, aut: 3, alg: 3, jor: 0 }, remaining: [['alg', 'aut'], ['jor', 'arg']] },
  { letter: 'K', pts: { por: 4, col: 4, cod: 2, uzb: 0 }, remaining: [['col', 'por'], ['cod', 'uzb']] },
  { letter: 'L', pts: { eng: 4, gha: 4, cro: 3, pan: 0 }, remaining: [['pan', 'eng'], ['cro', 'gha']] },
];

console.log('Real-data scenario:');
const advancesSet = new Set<string>();
const lockedAny = new Set<string>();
for (const g of GROUPS) {
  const matches = makeGroup(g.letter, g.pts, g.remaining);
  const ids = Object.keys(g.pts);
  const { byTeam } = resolveGroupQualifiers(computeStandings(ids, matches), matches);
  let advCount = 0;
  for (const [tid, q] of byTeam) {
    if (q.advances) { advancesSet.add(tid); advCount++; }
    if (q.lockedFirst || q.lockedSecond) lockedAny.add(tid);
  }
  assert(advCount <= 2, `group ${g.letter}: at most 2 advance (got ${advCount})`);
}

const expected = ['arg', 'fra', 'ger', 'mex', 'nor', 'usa'];
const got = [...advancesSet].sort();
assert(
  JSON.stringify(got) === JSON.stringify(expected),
  `advances == {${expected.join(',')}} (got {${got.join(',')}})`,
);
for (const t of ['can', 'bra', 'por', 'eng', 'esp', 'ned', 'egy'])
  assert(!advancesSet.has(t), `${t} does NOT advance (still catchable)`);
assert(lockedAny.size === 0, `no locked seed yet (got {${[...lockedAny].join(',')}})`);

// ── Edge: finished group with a points tie for 2nd still yields a runner-up ──
console.log('Edge — finished group (2nd-place points tie):');
{
  const matches = makeGroup('Z', { a: 9, b: 4, c: 4, d: 0 }, []); // all finished, b/c tie on pts
  const rows = computeStandings(['a', 'b', 'c', 'd'], matches);
  const { byTeam } = resolveGroupQualifiers(rows, matches);
  const advancers = rows.filter((r) => byTeam.get(r.teamId)?.advances).map((r) => r.teamId);
  assert(advancers.length === 2, `exactly 2 advance (got ${advancers.length})`);
  assert(!!byTeam.get(rows[0].teamId)?.lockedFirst, 'winner lockedFirst');
  assert(!!byTeam.get(rows[1].teamId)?.lockedSecond, 'runner-up lockedSecond (tie broken by order)');
}

// ── Edge: a remaining match with a missing team id is skipped, no throw ──────
console.log('Edge — remaining match missing a team id:');
{
  const matches = makeGroup('Y', { a: 6, b: 3, c: 3, d: 0 }, [['d', 'a'], ['b', 'c']]);
  // Corrupt one remaining fixture's away id.
  const broken = matches.find((m) => m.status === 'scheduled')!;
  broken.away_team_id = null;
  let threw = false;
  try {
    resolveGroupQualifiers(computeStandings(['a', 'b', 'c', 'd'], matches), matches);
  } catch {
    threw = true;
  }
  assert(!threw, 'does not throw on a null team id in a remaining fixture');
}

// ── Edge: stale official standings reconciled against real match results ─────
// Reproduces the real Group D bug: the official table froze TUR-USA at 2-2 (a
// draw) while the match actually finished 3-2 (USA lost). reconcileStandings
// must detect the mismatch and fall back to the match-derived table.
console.log('Edge — stale official standings fall back to match results:');
{
  const gd = (h: string, hs: number, asc: number, a: string) =>
    mkMatch({
      group_letter: 'D',
      status: 'finished',
      home_team_id: h,
      away_team_id: a,
      home_score: hs,
      away_score: asc,
    });
  const matches = [
    gd('usa', 4, 1, 'par'),
    gd('aus', 2, 0, 'tur'),
    gd('usa', 2, 0, 'aus'),
    gd('tur', 0, 1, 'par'),
    gd('par', 0, 0, 'aus'),
    gd('tur', 3, 2, 'usa'), // the result the stale standings missed
  ];
  const ids = ['usa', 'aus', 'par', 'tur'];
  const sr = (
    teamId: string,
    played: number,
    won: number,
    drawn: number,
    lost: number,
    gf: number,
    ga: number,
    points: number,
  ): StandingRow => ({ teamId, played, won, drawn, lost, goalsFor: gf, goalsAgainst: ga, goalDiff: gf - ga, points });
  const stale: StandingRow[] = [
    sr('usa', 3, 2, 1, 0, 8, 3, 7), // TUR-USA wrongly counted as a 2-2 draw
    sr('aus', 3, 1, 1, 1, 2, 2, 4),
    sr('par', 3, 1, 1, 1, 2, 4, 4),
    sr('tur', 3, 0, 1, 2, 2, 5, 1),
  ];
  const rec = reconcileStandings(stale, ids, matches);
  const byId = new Map(rec.map((r) => [r.teamId, r]));
  assert(
    byId.get('usa')!.points === 6 && byId.get('usa')!.lost === 1 && byId.get('usa')!.drawn === 0,
    'USA shows 6 pts + the real loss (not the stale draw)',
  );
  assert(byId.get('usa')!.goalsAgainst === 4, 'USA GA reflects the 3 conceded vs Turkey');
  assert(byId.get('tur')!.points === 3 && byId.get('tur')!.won === 1, 'Turkey shows the win (3 pts)');

  const good = reconcileStandings(computeStandings(ids, matches), ids, matches);
  assert(good.length === 4 && good[0].teamId === 'usa', 'consistent official rows are kept as-is');
}

// ── Knockout progression: parser + winner/loser + resolveBracket single-step ──
console.log('Knockout — progression resolver:');
{
  // Parsers stay disjoint: group slots vs match-progression refs.
  assert(parseProgressionSlot('Winner R32-2')?.ref === 'R32-2', 'parseProgressionSlot reads R32-2');
  assert(parseProgressionSlot('Loser SF-1')?.kind === 'loser', 'parseProgressionSlot reads Loser SF-1');
  assert(parseProgressionSlot('Winner A') === null, 'parseProgressionSlot rejects group slot "Winner A"');
  assert(parseProgressionSlot('3rd A/B/C/D/F') === null, 'parseProgressionSlot rejects best-third ref');
  assert(parseGroupSlot('Winner R32-2') === null, 'parseGroupSlot rejects a match ref');

  // winnerOf / loserOf by score, by penalties, and undecided.
  const byScore = mkMatch({ status: 'finished', home_team_id: 'rsa', away_team_id: 'can', home_score: 0, away_score: 1 });
  assert(winnerOf(byScore) === 'can' && loserOf(byScore) === 'rsa', 'winner/loser by score');
  const byPens = mkMatch({ status: 'finished', home_team_id: 'bra', away_team_id: 'arg', home_score: 1, away_score: 1, home_score_penalties: 2, away_score_penalties: 4 });
  assert(winnerOf(byPens) === 'arg' && loserOf(byPens) === 'bra', 'winner/loser by penalties');
  const live = mkMatch({ status: 'live', home_team_id: 'mex', away_team_id: 'usa', home_score: 1, away_score: 0 });
  assert(winningSide(live) === null && winnerOf(live) === null, 'no winner for a live match');

  // resolveBracket: a finished R32 advances its winner into the R16 slot; away stays TBD.
  const empty = new Map<string, { teamId: string; locked: boolean }>();
  const matches = [
    mkMatch({ id: 'R32-1', stage: 'r32', home_team_id: 'rsa', away_team_id: 'can', home_placeholder: 'Runner-up A', away_placeholder: 'Runner-up B', status: 'finished', home_score: 0, away_score: 1 }),
    mkMatch({ id: 'R32-3', stage: 'r32', home_team_id: 'ned', away_team_id: 'mar', home_placeholder: 'Winner F', away_placeholder: 'Runner-up C', status: 'scheduled' }),
    mkMatch({ id: 'R16-2', stage: 'r16', home_placeholder: 'Winner R32-1', away_placeholder: 'Winner R32-3', status: 'scheduled' }),
  ];
  const br = resolveBracket(matches, empty);
  const r16 = br.get('R16-2')!;
  assert(r16.home.teamId === 'can' && r16.home.confirmed, 'R16-2 home = Canada (winner of finished R32-1), confirmed');
  assert(r16.away.teamId === null, 'R16-2 away stays TBD until R32-3 finishes');
  assert(br.get('R32-1')!.home.teamId === 'rsa', 'R32 keeps its server ids');

  // Server-set id beats progression.
  const withServer = [
    mkMatch({ id: 'R32-1', stage: 'r32', home_team_id: 'rsa', away_team_id: 'can', status: 'finished', home_score: 0, away_score: 1 }),
    mkMatch({ id: 'R16-2', stage: 'r16', home_team_id: 'xyz', home_placeholder: 'Winner R32-1', away_placeholder: 'Winner R32-3', status: 'scheduled' }),
  ];
  assert(resolveBracket(withServer, empty).get('R16-2')!.home.teamId === 'xyz', 'server-set R16 id wins over progression');

  // Loser feeds the third-place match.
  const sf = [
    mkMatch({ id: 'SF-1', stage: 'sf', home_team_id: 'fra', away_team_id: 'ger', status: 'finished', home_score: 2, away_score: 0 }),
    mkMatch({ id: '3RD-1', stage: 'third', home_placeholder: 'Loser SF-1', away_placeholder: 'Loser SF-2', status: 'scheduled' }),
  ];
  assert(resolveBracket(sf, empty).get('3RD-1')!.home.teamId === 'ger', '3rd-place home = loser of SF-1 (Germany)');

  // Multi-hop: a FINISHED intermediate feeder whose own team ids are still null
  // must still progress its winner into the next round (fixed-point resolve).
  const multi = [
    mkMatch({ id: 'R32-2', stage: 'r32', home_team_id: 'usa', away_team_id: 'ita', status: 'finished', home_score: 2, away_score: 0 }),
    mkMatch({ id: 'R32-5', stage: 'r32', home_team_id: 'bra', away_team_id: 'cmr', status: 'finished', home_score: 1, away_score: 0 }),
    mkMatch({ id: 'R16-1', stage: 'r16', home_placeholder: 'Winner R32-2', away_placeholder: 'Winner R32-5', status: 'finished', home_score: 1, away_score: 0 }), // null team ids on purpose
    mkMatch({ id: 'QF-1', stage: 'qf', home_placeholder: 'Winner R16-1', away_placeholder: 'Winner R16-2', status: 'scheduled' }),
  ];
  const mbr = resolveBracket(multi, empty);
  assert(mbr.get('R16-1')!.home.teamId === 'usa', 'R16-1 home = winner of R32-2 (usa)');
  assert(
    mbr.get('QF-1')!.home.teamId === 'usa' && mbr.get('QF-1')!.home.confirmed,
    'QF-1 home = winner of finished R16-1 (usa) — multi-hop progression',
  );
  assert(mbr.get('QF-1')!.away.teamId === null, 'QF-1 away stays TBD (R16-2 absent)');
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);

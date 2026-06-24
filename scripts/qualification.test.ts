/**
 * Scenario tests for the bracket qualifier logic (run: `npx tsx
 * scripts/qualification.test.ts`). `scripts` is excluded from the `@/*` alias,
 * so import via relative paths. Reproduces the REAL group-stage state and
 * asserts exactly {mex,usa,ger,arg,fra,nor} have clinched advancement, none with
 * a locked seed yet — plus a few edge units. Exits non-zero on any failure.
 */
import type { Match, MatchStatus, Stage } from '../src/lib/database.types';
import { resolveGroupQualifiers } from '../src/lib/qualification';
import { computeStandings } from '../src/lib/standings';

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

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);

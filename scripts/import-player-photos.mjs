// Imports player headshot URLs (and shirt numbers) from API-Football squads
// into the `players` table, and backfills teams.api_football_id.
//
// Free-plan aware: ≤100 requests/day, 10/min — paces calls at ~6.5s and saves
// a checkpoint (scripts/.photo-import.json) so an interrupted run resumes
// without re-spending requests. Run: node scripts/import-player-photos.mjs
//
// Matching: API-Football squad names are abbreviated ("G. Ochoa") while our
// players (from football-data.org) carry full names ("Guillermo Ochoa") —
// match within each team by normalized surname + first initial.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── env (.env parse — server-only keys) ─────────────────────────────────────
const env = {};
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const SB_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SR_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const AF_KEY = env.APIFOOTBALL_KEY;
if (!SB_URL || !SR_KEY || !AF_KEY) {
  console.error('Need EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APIFOOTBALL_KEY in .env');
  process.exit(1);
}

const sbHeaders = {
  apikey: SR_KEY,
  Authorization: `Bearer ${SR_KEY}`,
  'Content-Type': 'application/json',
  Prefer: 'return=minimal',
};

async function sbGet(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: sbHeaders });
  if (!res.ok) throw new Error(`supabase GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}
async function sbPatch(path, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: sbHeaders,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`supabase PATCH ${path}: ${res.status} ${await res.text()}`);
}

// ── API-Football (paced for the free plan's 10 req/min) ─────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let afCalls = 0;
async function af(path) {
  await sleep(6500);
  afCalls++;
  const res = await fetch(`https://v3.football.api-sports.io/${path}`, {
    headers: { 'x-apisports-key': AF_KEY },
  });
  const json = await res.json();
  const errs = json.errors && Object.keys(json.errors).length ? json.errors : null;
  if (errs) throw new Error(`api-football ${path}: ${JSON.stringify(errs)}`);
  return json.response ?? [];
}

// ── name normalization & matching ───────────────────────────────────────────
const norm = (s) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Match an API-Football squad name ("G. Ochoa" / "Raul Jimenez") to one of
 *  our players (full names). Returns the player or null. */
function matchPlayer(afName, candidates) {
  const n = norm(afName);
  // 1. exact normalized match
  let hits = candidates.filter((p) => norm(p.name) === n);
  if (hits.length === 1) return hits[0];
  // 2. abbreviated "g ochoa" → initial + surname tail
  const tokens = n.split(' ');
  const initial = tokens[0]?.length === 1 ? tokens[0] : null;
  const tail = (initial ? tokens.slice(1) : tokens).join(' ');
  if (!tail) return null;
  const tailMatch = (p) => {
    const pn = norm(p.name);
    return pn === tail || pn.endsWith(` ${tail}`) || pn.includes(` ${tail} `);
  };
  hits = candidates.filter((p) => tailMatch(p) && (!initial || norm(p.name).startsWith(initial)));
  if (hits.length === 1) return hits[0];
  // 3. surname-only, if unambiguous
  hits = candidates.filter(tailMatch);
  return hits.length === 1 ? hits[0] : null;
}

// Our team names → API-Football search terms when they differ.
const SEARCH_ALIASES = {
  'korea republic': 'South Korea',
  'south korea': 'South Korea',
  "côte d'ivoire": 'Ivory Coast',
  'ivory coast': 'Ivory Coast',
  'united states': 'USA',
  usa: 'USA',
  'ir iran': 'Iran',
  iran: 'Iran',
  curacao: 'Curacao',
  curaçao: 'Curacao',
  czechia: 'Czech Republic',
  'cape verde': 'Cape Verde',
  'cabo verde': 'Cape Verde',
};

// ── checkpoint ───────────────────────────────────────────────────────────────
const ckptPath = join(root, 'scripts', '.photo-import.json');
const ckpt = existsSync(ckptPath)
  ? JSON.parse(readFileSync(ckptPath, 'utf8'))
  : { afIds: {}, doneTeams: [] };
const save = () => writeFileSync(ckptPath, JSON.stringify(ckpt, null, 2));

// ── main ─────────────────────────────────────────────────────────────────────
const teams = await sbGet('teams?select=id,name,api_football_id&order=id');
const players = await sbGet('players?select=id,team_id,name&limit=2000');
const byTeam = new Map();
for (const p of players) {
  (byTeam.get(p.team_id) ?? byTeam.set(p.team_id, []).get(p.team_id)).push(p);
}

let matched = 0;
let unmatched = [];
let persistenceVerified = false;
try {
  for (const team of teams) {
    if (ckpt.doneTeams.includes(team.id)) continue;

    // 1. resolve the API-Football national-team id
    let afId = team.api_football_id ?? ckpt.afIds[team.id];
    if (!afId) {
      const term = SEARCH_ALIASES[norm(team.name)] ?? team.name;
      const found = await af(`teams?search=${encodeURIComponent(term)}`);
      // Men's national team: national=true and NOT a women's side ("Canada W").
      const nat =
        found.find((r) => r.team?.national && !/\sW$/i.test(r.team?.name ?? '')) ??
        found.find((r) => r.team?.national) ??
        found[0];
      if (!nat) {
        console.warn(`✗ ${team.id} (${team.name}): no API-Football team found`);
        ckpt.doneTeams.push(team.id);
        save();
        continue;
      }
      afId = nat.team.id;
      ckpt.afIds[team.id] = afId;
      save();
      await sbPatch(`teams?id=eq.${team.id}`, { api_football_id: afId });
    }

    // 2. squad → photos + shirt numbers
    const squads = await af(`players/squads?team=${afId}`);
    const squad = squads[0]?.players ?? [];
    const ours = byTeam.get(team.id) ?? [];
    let teamMatched = 0;
    for (const sp of squad) {
      const mine = matchPlayer(sp.name, ours);
      if (!mine) {
        unmatched.push(`${team.id}: ${sp.name}`);
        continue;
      }
      await sbPatch(`players?id=eq.${mine.id}`, {
        photo_url: sp.photo ?? null,
        shirt_number: typeof sp.number === 'number' ? sp.number : null,
      });
      // Fail fast if PostgREST's schema cache silently drops photo_url (it
      // ate the entire first run: 742 shirt numbers landed, 0 photos).
      if (!persistenceVerified && sp.photo) {
        const [check] = await sbGet(`players?select=photo_url&id=eq.${mine.id}`);
        if (check?.photo_url !== sp.photo) {
          throw new Error(
            'photo_url did not persist — PostgREST schema cache is stale. ' +
              'Reload it (Supabase dashboard → Settings → API → Reload schema) and re-run.',
          );
        }
        persistenceVerified = true;
      }
      teamMatched++;
      matched++;
    }
    console.log(`✓ ${team.id} (${team.name}): ${teamMatched}/${squad.length} fotos (af ${afId})`);
    ckpt.doneTeams.push(team.id);
    save();
  }
} catch (e) {
  console.error(`\nStopped after ${afCalls} API calls: ${e.message}`);
  console.error('Progress is checkpointed — re-run tomorrow to resume.');
  process.exitCode = 1;
}

console.log(`\nDone. Teams completed: ${ckpt.doneTeams.length}/${teams.length} · players matched this run: ${matched} · API calls: ${afCalls}`);
if (unmatched.length) {
  console.log(`Unmatched (${unmatched.length}):\n  ` + unmatched.join('\n  '));
}

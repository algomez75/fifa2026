// One-time backfill of team match statistics (ball possession, shots, corners…)
// for matches that FINISHED before the football-data Stats-Package add-on was
// active — sync-scores only fetches detail inside a live/finish window, so once
// a match is finished+scored it is never re-fetched and its `match_details`
// stats stay NULL. This re-fetches /v4/matches/{id} for every finished match and
// merges the stats into `match_details` (lineups already there are preserved by
// the on-conflict merge). Safe to re-run.
//
// Run: node scripts/backfill-stats.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── env (.env parse — server-only keys) ─────────────────────────────────────
const env = {};
for (const line of readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const SB_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SR_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const TOKEN = env.FOOTBALLDATA_TOKEN;
if (!SB_URL || !SR_KEY || !TOKEN) {
  console.error('Need EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOOTBALLDATA_TOKEN in .env');
  process.exit(1);
}

const sbHeaders = {
  apikey: SR_KEY,
  Authorization: `Bearer ${SR_KEY}`,
  'Content-Type': 'application/json',
};

async function sbGet(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: sbHeaders });
  if (!res.ok) throw new Error(`supabase GET ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}
async function sbUpsert(row) {
  const res = await fetch(`${SB_URL}/rest/v1/match_details?on_conflict=match_id`, {
    method: 'POST',
    headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`supabase upsert: ${res.status} ${await res.text()}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fd(path) {
  const res = await fetch(`https://api.football-data.org/v4${path}`, {
    headers: { 'X-Auth-Token': TOKEN },
  });
  if (!res.ok) return null;
  return res.json();
}

/** Real stats object, or null when the add-on placeholder `{msg}` came back. */
const statsOf = (t) =>
  t?.statistics && typeof t.statistics === 'object' && !('msg' in t.statistics)
    ? t.statistics
    : null;

const matches = await sbGet(
  'matches?status=eq.finished&api_football_fixture_id=not.is.null&select=id,api_football_fixture_id&order=kickoff_utc.asc',
);
console.log(`Finished matches to backfill: ${matches.length}`);

let filled = 0;
let noStats = 0;
for (const m of matches) {
  await sleep(6500); // ~10 req/min — comfortably inside the rate limit
  const detail = await fd(`/matches/${m.api_football_fixture_id}`);
  if (!detail) {
    console.log(`  ${m.id}: detail fetch failed`);
    continue;
  }
  const home = statsOf(detail.homeTeam);
  const away = statsOf(detail.awayTeam);
  if (!home && !away) {
    noStats++;
    console.log(`  ${m.id}: no stats available`);
    continue;
  }
  await sbUpsert({
    match_id: m.id,
    home_stats: home,
    away_stats: away,
    referee: detail.referees?.[0]?.name ?? null,
    referees: (detail.referees ?? []).map((r) => ({
      name: r.name ?? null,
      type: r.type ?? null,
      nationality: r.nationality ?? null,
    })),
    attendance: detail.attendance ?? null,
    injury_time: detail.injuryTime ?? null,
    updated_at: new Date().toISOString(),
  });
  filled++;
  console.log(
    `  ✓ ${m.id}: possession ${home?.ball_possession ?? '–'}/${away?.ball_possession ?? '–'}, ` +
      `shots ${home?.shots ?? '–'}/${away?.shots ?? '–'}`,
  );
}

console.log(`\nDone. Filled ${filled}, no-stats ${noStats}, total ${matches.length}.`);

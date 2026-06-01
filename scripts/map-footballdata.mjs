// Maps football-data.org WC2026 match ids → our match ids, stores them in
// matches.api_football_fixture_id (reused as the generic external id).
// Run: FOOTBALLDATA_TOKEN=... SUPABASE_ACCESS_TOKEN=... SUPABASE_REF=... node scripts/map-footballdata.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedDir = join(__dirname, '..', 'data', 'seed');
const teams = JSON.parse(readFileSync(join(seedDir, 'teams.json'), 'utf8'));
const ours = JSON.parse(readFileSync(join(seedDir, 'schedule.json'), 'utf8'));

const TOKEN = process.env.FOOTBALLDATA_TOKEN;
const SB_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_REF;
if (!TOKEN || !SB_TOKEN || !REF) {
  console.error('Need FOOTBALLDATA_TOKEN, SUPABASE_ACCESS_TOKEN, SUPABASE_REF');
  process.exit(1);
}

const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');

// our team name/es → id, plus aliases for football-data naming differences
const nameToId = {};
for (const t of teams) {
  nameToId[norm(t.name)] = t.id;
  if (t.name_es) nameToId[norm(t.name_es)] = t.id;
}
Object.assign(nameToId, {
  [norm('Bosnia-Herzegovina')]: 'bih',
  [norm('Bosnia and Herzegovina')]: 'bih',
  [norm('Ivory Coast')]: 'civ',
  [norm("Cote d'Ivoire")]: 'civ',
  [norm('DR Congo')]: 'cod',
  [norm('Congo DR')]: 'cod',
  [norm('Cape Verde')]: 'cpv',
  [norm('Cape Verde Islands')]: 'cpv',
  [norm('Cabo Verde')]: 'cpv',
  [norm('Curacao')]: 'cuw',
  [norm('United States')]: 'usa',
  [norm('USA')]: 'usa',
  [norm('Czech Republic')]: 'cze',
  [norm('Korea Republic')]: 'kor',
  [norm('IR Iran')]: 'irn',
  [norm('Turkiye')]: 'tur',
});
const idOf = (name) => nameToId[norm(name)] ?? null;

// our stage → football-data stage label
const STAGE_MAP = {
  r32: ['LAST_32'],
  r16: ['LAST_16'],
  qf: ['QUARTER_FINALS'],
  sf: ['SEMI_FINALS'],
  third: ['THIRD_PLACE'],
  final: ['FINAL'],
};

async function main() {
  const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': TOKEN },
  });
  const json = await res.json();
  const theirs = json.matches ?? [];
  console.log(`football-data: ${theirs.length} matches`);

  const stages = [...new Set(theirs.map((m) => m.stage))];
  console.log('their stages:', stages.join(', '));

  const mapping = []; // { ourId, theirId }
  const unmatched = [];

  // --- group stage: match by unordered team-id pair ---
  const theirGroup = theirs.filter((m) => m.stage === 'GROUP_STAGE');
  const pairToTheir = {};
  for (const m of theirGroup) {
    const h = idOf(m.homeTeam?.name);
    const a = idOf(m.awayTeam?.name);
    if (!h || !a) {
      unmatched.push(`their ${m.id} ${m.homeTeam?.name} vs ${m.awayTeam?.name}`);
      continue;
    }
    pairToTheir[[h, a].sort().join('-')] = m.id;
  }
  for (const o of ours.filter((m) => m.stage === 'group')) {
    const key = [o.home_team_id, o.away_team_id].sort().join('-');
    const theirId = pairToTheir[key];
    if (theirId) mapping.push({ ourId: o.id, theirId });
    else unmatched.push(`our ${o.id} ${o.home_team_id}-${o.away_team_id} (no pair)`);
  }

  // --- knockout: match by stage + chronological order ---
  for (const [ourStage, labels] of Object.entries(STAGE_MAP)) {
    const t = theirs
      .filter((m) => labels.includes(m.stage))
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
    const o = ours
      .filter((m) => m.stage === ourStage)
      .sort((a, b) => new Date(a.kickoff_utc) - new Date(b.kickoff_utc));
    if (t.length !== o.length)
      console.warn(`⚠ ${ourStage}: ours ${o.length} vs theirs ${t.length}`);
    o.forEach((om, i) => {
      if (t[i]) mapping.push({ ourId: om.id, theirId: t[i].id });
    });
  }

  console.log(`mapped: ${mapping.length}/104`);
  if (unmatched.length) console.log('UNMATCHED:\n  ' + unmatched.join('\n  '));

  // --- apply via Management API ---
  const values = mapping.map((m) => `('${m.ourId}', ${m.theirId})`).join(', ');
  const sql = `UPDATE matches AS m SET api_football_fixture_id = v.fid
    FROM (VALUES ${values}) AS v(id, fid) WHERE m.id = v.id;`;
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${SB_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql }),
    },
  );
  console.log('apply →', r.status, r.ok ? 'OK' : await r.text());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

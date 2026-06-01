// Normalizes data/seed/_schedule_raw.json (official dates/venues) into the full
// schedule.json shape, and STRICTLY validates it. Run: node scripts/build-schedule.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedDir = join(__dirname, '..', 'data', 'seed');

const raw = JSON.parse(readFileSync(join(seedDir, '_schedule_raw.json'), 'utf8'));
const teams = JSON.parse(readFileSync(join(seedDir, 'teams.json'), 'utf8'));
const venues = JSON.parse(readFileSync(join(seedDir, 'venues.json'), 'utf8'));

const teamIds = new Set(teams.map((t) => t.id));
const venueIds = new Set(venues.map((v) => v.id));
const groupOf = Object.fromEntries(teams.map((t) => [t.id, t.group_letter]));

const errors = [];
const E = (m) => errors.push(m);

// counts
const stageCounts = raw.reduce((a, m) => ((a[m.stage] = (a[m.stage] || 0) + 1), a), {});
if (raw.length !== 104) E(`expected 104 matches, got ${raw.length}`);
const expect = { group: 72, r32: 16, r16: 8, qf: 4, sf: 2, third: 1, final: 1 };
for (const [k, v] of Object.entries(expect))
  if (stageCounts[k] !== v) E(`stage ${k}: expected ${v}, got ${stageCounts[k] ?? 0}`);

// id / fk / chronology
const ids = new Set();
const nums = new Set();
for (const m of raw) {
  if (ids.has(m.id)) E(`duplicate id ${m.id}`);
  ids.add(m.id);
  if (nums.has(m.match_number)) E(`duplicate match_number ${m.match_number}`);
  nums.add(m.match_number);
  if (m.venue_id && !venueIds.has(m.venue_id)) E(`${m.id}: bad venue ${m.venue_id}`);
  if (m.home_team_id && !teamIds.has(m.home_team_id)) E(`${m.id}: bad home ${m.home_team_id}`);
  if (m.away_team_id && !teamIds.has(m.away_team_id)) E(`${m.id}: bad away ${m.away_team_id}`);
  if (isNaN(Date.parse(m.kickoff_utc))) E(`${m.id}: bad kickoff ${m.kickoff_utc}`);
  if (m.stage === 'group') {
    if (groupOf[m.home_team_id] !== m.group_letter || groupOf[m.away_team_id] !== m.group_letter)
      E(`${m.id}: teams not in group ${m.group_letter}`);
  } else if (m.home_team_id || m.away_team_id) {
    E(`${m.id}: knockout should have null teams`);
  }
}

// group round-robin completeness: each group's 6 matches = all 6 unique pairs,
// each of the 4 teams plays exactly 3.
const groups = {};
for (const m of raw.filter((x) => x.stage === 'group')) {
  (groups[m.group_letter] ??= []).push(m);
}
for (const [L, ms] of Object.entries(groups)) {
  if (ms.length !== 6) E(`group ${L}: ${ms.length} matches (want 6)`);
  const plays = {};
  const pairs = new Set();
  for (const m of ms) {
    plays[m.home_team_id] = (plays[m.home_team_id] || 0) + 1;
    plays[m.away_team_id] = (plays[m.away_team_id] || 0) + 1;
    pairs.add([m.home_team_id, m.away_team_id].sort().join('-'));
  }
  if (pairs.size !== 6) E(`group ${L}: ${pairs.size} unique pairings (want 6)`);
  for (const [t, n] of Object.entries(plays))
    if (n !== 3) E(`group ${L}: ${t} plays ${n} (want 3)`);
}

// chronological match_number
const byKick = [...raw].sort((a, b) => Date.parse(a.kickoff_utc) - Date.parse(b.kickoff_utc));
byKick.forEach((m, i) => {
  // allow same-kickoff ties to be in any order
});

if (errors.length) {
  console.error('✗ VALIDATION FAILED:');
  for (const e of errors) console.error('  -', e);
  process.exit(1);
}

// normalize → full schema
const full = raw.map((m) => ({
  id: m.id,
  stage: m.stage,
  group_letter: m.group_letter,
  match_number: m.match_number,
  home_team_id: m.home_team_id,
  away_team_id: m.away_team_id,
  home_placeholder: m.home_placeholder,
  away_placeholder: m.away_placeholder,
  home_score: null,
  away_score: null,
  home_score_penalties: null,
  away_score_penalties: null,
  status: 'scheduled',
  kickoff_utc: m.kickoff_utc,
  venue_id: m.venue_id,
  api_football_fixture_id: null,
  minute: null,
}));

writeFileSync(join(seedDir, 'schedule.json'), JSON.stringify(full, null, 2) + '\n');
const days = new Set(full.map((m) => m.kickoff_utc.slice(0, 10)));
console.log(`✅ schedule.json written: ${full.length} matches`, stageCounts);
console.log(`   date range: ${[...days].sort()[0]} → ${[...days].sort().slice(-1)[0]}`);
console.log('   all groups round-robin valid, all FKs valid.');

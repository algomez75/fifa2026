// Imports all 48 World Cup squads + team metadata (crest, coach) from
// football-data.org into Supabase. One API request for all teams.
// Run: FOOTBALLDATA_TOKEN=... node scripts/import-squads.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const l of readFileSync('.env', 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const TOKEN = process.env.FOOTBALLDATA_TOKEN;
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!TOKEN || !URL || !SR) { console.error('Need FOOTBALLDATA_TOKEN + Supabase env'); process.exit(1); }

const sb = createClient(URL, SR, { auth: { persistSession: false } });
const teams = JSON.parse(readFileSync('data/seed/teams.json', 'utf8'));

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const nameToId = {};
for (const t of teams) { nameToId[norm(t.name)] = t.id; if (t.name_es) nameToId[norm(t.name_es)] = t.id; }
Object.assign(nameToId, {
  [norm('Bosnia-Herzegovina')]: 'bih', [norm('Bosnia and Herzegovina')]: 'bih',
  [norm('Ivory Coast')]: 'civ', [norm("Cote d'Ivoire")]: 'civ',
  [norm('DR Congo')]: 'cod', [norm('Congo DR')]: 'cod',
  [norm('Cape Verde')]: 'cpv', [norm('Cape Verde Islands')]: 'cpv', [norm('Cabo Verde')]: 'cpv',
  [norm('Curacao')]: 'cuw', [norm('United States')]: 'usa', [norm('USA')]: 'usa',
  [norm('Czech Republic')]: 'cze', [norm('Korea Republic')]: 'kor', [norm('IR Iran')]: 'irn',
  [norm('Turkiye')]: 'tur',
});
const idOf = (name) => nameToId[norm(name)] ?? null;

const res = await fetch('https://api.football-data.org/v4/competitions/WC/teams', { headers: { 'X-Auth-Token': TOKEN } });
const json = await res.json();
const fdTeams = json.teams ?? [];
console.log(`football-data: ${fdTeams.length} teams`);

let teamsUpdated = 0, playersInserted = 0;
const unmatched = [];
for (const ft of fdTeams) {
  const teamId = idOf(ft.name);
  if (!teamId) { unmatched.push(ft.name); continue; }

  await sb.from('teams').update({
    crest_url: ft.crest ?? null,
    coach: ft.coach?.name ?? null,
    fd_team_id: ft.id,
  }).eq('id', teamId);
  teamsUpdated++;

  await sb.from('players').delete().eq('team_id', teamId);
  const rows = (ft.squad ?? []).map((p) => ({
    team_id: teamId,
    fd_player_id: p.id,
    name: p.name,
    position: p.position ?? null,
    date_of_birth: p.dateOfBirth ?? null,
    nationality: p.nationality ?? null,
    shirt_number: p.shirtNumber ?? null,
  }));
  if (rows.length) {
    const ins = await sb.from('players').insert(rows);
    if (ins.error) console.warn(`  ⚠ ${teamId}: ${ins.error.message}`);
    else playersInserted += rows.length;
  }
}

console.log(`✅ teams updated: ${teamsUpdated} | players inserted: ${playersInserted}`);
if (unmatched.length) console.log('UNMATCHED teams:', unmatched.join(', '));

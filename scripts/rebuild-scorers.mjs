// rebuild-scorers.mjs — one-shot: repopulate the WC golden boot (`top_scorers`)
// from football-data, with competition_id set (PK is (competition_id, rank)
// since migration 027 — sync-scores' old insert omitted it, failed NOT NULL,
// and left the table empty after its delete-all).
//   node scripts/rebuild-scorers.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const l of readFileSync('.env', 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}
const FD = process.env.FOOTBALLDATA_TOKEN;
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!FD || !URL || !SR) { console.error('Need FOOTBALLDATA_TOKEN + Supabase env'); process.exit(1); }
const sb = createClient(URL, SR, { auth: { persistSession: false } });
const WC = 'world-cup-2026';

// Team map (fd id → our id) — same as sync-scores.
const { data: teams } = await sb.from('teams').select('id, fd_team_id').not('fd_team_id', 'is', null);
const byFd = new Map((teams ?? []).map((t) => [t.fd_team_id, t.id]));

// Player lookup (normalized name within team) so rows carry player_id → photo.
const normName = (s) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const playersByTeam = new Map();
for (let from = 0; ; from += 1000) {
  const { data: page } = await sb.from('players').select('id, team_id, name').order('id').range(from, from + 999);
  for (const p of page ?? []) {
    const list = playersByTeam.get(p.team_id) ?? [];
    list.push({ id: p.id, key: normName(p.name) });
    playersByTeam.set(p.team_id, list);
  }
  if (!page || page.length < 1000) break;
}
const resolvePlayer = (teamId, name) => {
  if (!teamId || !name) return null;
  const key = normName(name);
  const list = playersByTeam.get(teamId) ?? [];
  const exact = list.filter((p) => p.key === key);
  if (exact.length === 1) return exact[0].id;
  const tokens = key.split(' ');
  const initial = tokens[0]?.length === 1 ? tokens[0] : null;
  const tail = (initial ? tokens.slice(1) : tokens).join(' ');
  if (!tail) return null;
  const hits = list.filter(
    (p) =>
      (p.key === tail || p.key.endsWith(` ${tail}`) || p.key.includes(` ${tail} `)) &&
      (!initial || p.key.startsWith(initial)),
  );
  return hits.length === 1 ? hits[0].id : null;
};

const res = await fetch('https://api.football-data.org/v4/competitions/WC/scorers?limit=20', {
  headers: { 'X-Auth-Token': FD },
});
const json = await res.json();
const list = json.scorers ?? [];
if (!list.length) { console.error('football-data returned no scorers:', JSON.stringify(json).slice(0, 200)); process.exit(1); }

// Official Golden Boot tiebreak (football-data's own order ignores assists):
// goals → assists → fewer matches played.
list.sort(
  (a, b) =>
    (b.goals ?? 0) - (a.goals ?? 0) ||
    (b.assists ?? 0) - (a.assists ?? 0) ||
    (a.playedMatches ?? 99) - (b.playedMatches ?? 99),
);

const rows = list.map((s, i) => {
  const teamId = byFd.get(s.team?.id) ?? null;
  return {
    competition_id: WC,
    rank: i + 1,
    fd_player_id: s.player?.id ?? null,
    player_id: resolvePlayer(teamId, s.player?.name ?? null),
    player_name: s.player?.name ?? 'Unknown',
    team_id: teamId,
    goals: s.goals ?? 0,
    assists: s.assists ?? null,
    penalties: s.penalties ?? null,
    played: s.playedMatches ?? null,
    updated_at: new Date().toISOString(),
  };
});

const del = await sb.from('top_scorers').delete().eq('competition_id', WC);
if (del.error) { console.error('clear:', del.error.message); process.exit(1); }
const ins = await sb.from('top_scorers').insert(rows);
if (ins.error) { console.error('insert:', ins.error.message); process.exit(1); }
console.log(`✅ Golden boot rebuilt: ${rows.length} rows (top: ${rows[0].player_name} ${rows[0].goals}g, player_id=${rows[0].player_id ?? 'null'}).`);

// End-to-end RLS smoke test — exercises the same paths the app does.
//   node scripts/verify.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// load .env
for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ok = (m) => console.log(`✓ ${m}`);
const fail = (m, e) => {
  console.error(`✗ ${m}`, e?.message ?? e);
  process.exitCode = 1;
};

async function main() {
  // 1. Public read (no auth) — what useMatches/useTeams do.
  const matches = await supabase.from('matches').select('id').limit(500);
  matches.error ? fail('public read matches', matches.error)
    : ok(`public read matches: ${matches.data.length}`);

  const teams = await supabase.from('teams').select('id');
  teams.error ? fail('public read teams', teams.error)
    : ok(`public read teams: ${teams.data.length}`);

  // 2. Anonymous sign-in — what useAnonAuth does.
  const auth = await supabase.auth.signInAnonymously();
  if (auth.error) return fail('anonymous sign-in', auth.error);
  const userId = auth.data.user?.id;
  ok(`anonymous sign-in: ${userId?.slice(0, 8)}…`);

  // 3. Favorites persist — what useFavorites.syncRemote does.
  const fav = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, favorite_team_ids: ['bra', 'arg', 'mex'] });
  fav.error ? fail('write user_settings (favorites)', fav.error)
    : ok('write user_settings (favorites)');

  const readBack = await supabase
    .from('user_settings')
    .select('favorite_team_ids')
    .eq('user_id', userId)
    .single();
  readBack.error ? fail('read back favorites', readBack.error)
    : ok(`read back favorites: [${readBack.data.favorite_team_ids.join(', ')}]`);

  // 4. RLS isolation — must NOT see other users' settings.
  const others = await supabase.from('user_settings').select('user_id');
  if (others.error) fail('rls isolation query', others.error);
  else if (others.data.length === 1) ok('RLS isolation: only own settings visible');
  else fail(`RLS isolation: saw ${others.data.length} rows (expected 1)`);

  // 5. Manual score write-back — what useUpdateScore does (authenticated).
  const target = matches.data?.[0]?.id;
  const upd = await supabase
    .from('matches')
    .update({ home_score: 2, away_score: 1, status: 'finished' })
    .eq('id', target)
    .select('id, home_score, away_score, status')
    .single();
  upd.error ? fail('score write-back', upd.error)
    : ok(`score write-back: ${upd.data.id} → ${upd.data.home_score}-${upd.data.away_score} (${upd.data.status})`);

  // reset that match so the seed stays pristine
  await supabase
    .from('matches')
    .update({ home_score: null, away_score: null, status: 'scheduled' })
    .eq('id', target);
  ok('reset test match to scheduled');

  // cleanup the anonymous user's settings row
  await supabase.from('user_settings').delete().eq('user_id', userId);
  console.log('\nDone.');
}

main().catch((e) => fail('unexpected', e));

/**
 * Seeds a Supabase project from the canonical JSON in /data/seed using the
 * service-role key (bypasses RLS). Run AFTER migrations are applied:
 *
 *   EXPO_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed.ts
 *
 * Idempotent — upserts by primary key.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedDir = join(__dirname, '..', 'data', 'seed');
const read = (f: string) => JSON.parse(readFileSync(join(seedDir, f), 'utf8'));

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const teams = read('teams.json');
  const venues = read('venues.json');
  const matches = read('schedule.json');
  const hist = read('historical.json');

  // Order matters for FKs: venues + teams → matches.
  const v = await supabase.from('venues').upsert(venues);
  if (v.error) throw v.error;
  console.log(`✓ venues: ${venues.length}`);

  const t = await supabase.from('teams').upsert(teams);
  if (t.error) throw t.error;
  console.log(`✓ teams: ${teams.length}`);

  const m = await supabase.from('matches').upsert(matches);
  if (m.error) throw m.error;
  console.log(`✓ matches: ${matches.length}`);

  const e = await supabase.from('historical_editions').upsert(hist.editions);
  if (e.error) throw e.error;
  console.log(`✓ editions: ${hist.editions.length}`);

  // historical_matches has a serial id; replace wholesale.
  await supabase.from('historical_matches').delete().neq('id', 0);
  const hm = await supabase.from('historical_matches').insert(hist.matches);
  if (hm.error) throw hm.error;
  console.log(`✓ historical matches: ${hist.matches.length}`);

  console.log('\n✅ Seed complete.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

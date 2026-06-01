// supabase/functions/sync-scores/index.ts
//
// Live score sync from football-data.org (free tier covers the FIFA World Cup).
// Runs every 60s via pg_cron. Self-throttles: only calls the API when a match
// is in its in-progress window, protecting the free-tier rate limit.
// Matches are linked via matches.api_football_fixture_id == football-data match id
// (populated by scripts/map-footballdata.mjs).
//
// Deploy:  supabase functions deploy sync-scores
// Secret:  supabase secrets set FOOTBALLDATA_TOKEN=xxxx
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TOKEN = Deno.env.get('FOOTBALLDATA_TOKEN') ?? '';

function mapStatus(s: string): 'live' | 'finished' | null {
  if (s === 'IN_PLAY' || s === 'PAUSED' || s === 'SUSPENDED') return 'live';
  if (s === 'FINISHED' || s === 'AWARDED') return 'finished';
  return null; // SCHEDULED/TIMED/POSTPONED/CANCELLED → don't touch
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1. Guard: is any match in its in-progress window?
  //    (live now, or kicked off in the last 4h and not yet finished)
  const now = Date.now();
  const windowStart = new Date(now - 4 * 60 * 60_000).toISOString();
  const soon = new Date(now + 10 * 60_000).toISOString();
  const { data: active, error: gErr } = await supabase
    .from('matches')
    .select('id')
    .neq('status', 'finished')
    .lte('kickoff_utc', soon)
    .gte('kickoff_utc', windowStart)
    .limit(1);
  if (gErr) return Response.json({ error: gErr.message }, { status: 500 });
  if (!active || active.length === 0)
    return Response.json({ skipped: 'no matches in progress window', updated: 0 });
  if (!TOKEN)
    return Response.json({ skipped: 'FOOTBALLDATA_TOKEN not set', updated: 0 });

  // 2. Fetch the full WC match list (one request).
  const res = await fetch(
    'https://api.football-data.org/v4/competitions/WC/matches',
    { headers: { 'X-Auth-Token': TOKEN } },
  );
  if (!res.ok)
    return Response.json({ error: `football-data ${res.status}` }, { status: 502 });
  const json = await res.json();
  const matches = (json.matches ?? []) as any[];

  // 3. Upsert scores for matches that are live or finished.
  let updated = 0;
  for (const m of matches) {
    const status = mapStatus(m.status);
    if (!status) continue;
    const ft = m.score?.fullTime ?? {};
    const pen = m.score?.penalties ?? {};
    const { error } = await supabase
      .from('matches')
      .update({
        home_score: ft.home ?? null,
        away_score: ft.away ?? null,
        home_score_penalties: pen.home ?? null,
        away_score_penalties: pen.away ?? null,
        minute: typeof m.minute === 'number' ? m.minute : null,
        status,
      })
      .eq('api_football_fixture_id', m.id);
    if (!error) updated++;
  }

  return Response.json({ updated, scanned: matches.length });
});

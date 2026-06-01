// supabase/functions/sync-scores/index.ts
//
// Live score sync. Intended to run every 60s via pg_cron (see 006_cron.sql).
// Optimizes the API-Football free tier (100 req/day) by ONLY calling the API
// when at least one match is currently 'live'. Inert until APIFOOTBALL_KEY is set.
//
// Deploy:  supabase functions deploy sync-scores
// Secret:  supabase secrets set APIFOOTBALL_KEY=xxxx
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const API_KEY = Deno.env.get('APIFOOTBALL_KEY') ?? '';
const SEASON = 2026;
const LEAGUE = 1; // FIFA World Cup

function mapStatus(short: string): 'scheduled' | 'live' | 'finished' {
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(short)) return 'live';
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished';
  return 'scheduled';
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1. Cheap guard: are any matches live (or kicking off within 5 min)?
  const soon = new Date(Date.now() + 5 * 60_000).toISOString();
  const { data: active, error: activeErr } = await supabase
    .from('matches')
    .select('id')
    .or(`status.eq.live,and(status.eq.scheduled,kickoff_utc.lte.${soon})`)
    .limit(1);

  if (activeErr) {
    return Response.json({ error: activeErr.message }, { status: 500 });
  }
  if (!active || active.length === 0) {
    return Response.json({ skipped: 'no live matches', updated: 0 });
  }
  if (!API_KEY) {
    return Response.json({ skipped: 'APIFOOTBALL_KEY not set', updated: 0 });
  }

  // 2. Fetch live fixtures from API-Football.
  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures?live=all&league=${LEAGUE}&season=${SEASON}`,
    { headers: { 'x-rapidapi-key': API_KEY, 'x-rapidapi-host': 'v3.football.api-sports.io' } },
  );
  if (!res.ok) {
    return Response.json({ error: `API-Football ${res.status}` }, { status: 502 });
  }
  const json = await res.json();
  const fixtures = (json.response ?? []) as any[];

  // 3. Upsert by api_football_fixture_id.
  let updated = 0;
  for (const f of fixtures) {
    const fixtureId = f.fixture?.id;
    if (!fixtureId) continue;
    const { error } = await supabase
      .from('matches')
      .update({
        home_score: f.goals?.home ?? null,
        away_score: f.goals?.away ?? null,
        minute: f.fixture?.status?.elapsed ?? null,
        status: mapStatus(f.fixture?.status?.short ?? ''),
      })
      .eq('api_football_fixture_id', fixtureId);
    if (!error) updated++;
  }

  return Response.json({ updated, fixtures: fixtures.length });
});

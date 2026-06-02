// supabase/functions/import-history/index.ts
//
// One-shot historical import. POST the bundled data/seed/historical.json body:
//
//   curl -X POST "$FUNCTIONS_URL/import-history" \
//     -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
//     -H "Content-Type: application/json" \
//     --data @data/seed/historical.json
//
// Alternatively, with no body it pulls the openfootball World Cup index and
// imports edition winners (1930–2022).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENFOOTBALL =
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/worldcup.history.json';

interface Edition {
  year: number;
  host?: string | null;
  champion?: string | null;
  runner_up?: string | null;
  third_place?: string | null;
  total_goals?: number | null;
  total_teams?: number | null;
  final_score?: string | null;
  top_scorer?: string | null;
}

Deno.serve(async (req) => {
  // Admin-only. `verify_jwt = true` only proves the caller has *some* valid JWT —
  // and the app issues anonymous-user JWTs to everyone, which would otherwise let
  // any client wipe/overwrite the public historical data. Require the service-role
  // key itself as the bearer token (matches the documented curl usage above).
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token || token !== SERVICE_ROLE) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  let editions: Edition[] = [];
  let matches: any[] = [];

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    editions = Array.isArray(body.editions) ? body.editions : [];
    matches = Array.isArray(body.matches) ? body.matches : [];
  }

  // Fallback: pull a compact history from openfootball if nothing was posted.
  if (editions.length === 0) {
    try {
      const res = await fetch(OPENFOOTBALL);
      if (res.ok) {
        const data = await res.json();
        editions = (data.editions ?? data ?? []).map((e: any) => ({
          year: e.year,
          host: e.host ?? null,
          champion: e.champion ?? e.winner ?? null,
          runner_up: e.runner_up ?? e.runnerup ?? null,
          third_place: e.third ?? null,
          total_goals: e.goals ?? null,
          total_teams: e.teams ?? null,
          final_score: e.final_score ?? null,
          top_scorer: e.top_scorer ?? null,
        }));
      }
    } catch {
      // ignore — return error below if still empty
    }
  }

  if (editions.length === 0) {
    return Response.json(
      { error: 'No editions to import (post historical.json or check openfootball).' },
      { status: 400 },
    );
  }

  // Basic shape validation — every edition must at least carry a numeric year.
  if (!editions.every((ed) => ed && typeof ed.year === 'number')) {
    return Response.json({ error: 'Invalid editions payload' }, { status: 400 });
  }

  const e = await supabase.from('historical_editions').upsert(editions);
  if (e.error) return Response.json({ error: e.error.message }, { status: 500 });

  let matchCount = 0;
  if (matches.length) {
    await supabase.from('historical_matches').delete().neq('id', 0);
    const m = await supabase.from('historical_matches').insert(matches);
    if (m.error) return Response.json({ error: m.error.message }, { status: 500 });
    matchCount = matches.length;
  }

  return Response.json({ editions: editions.length, matches: matchCount });
});

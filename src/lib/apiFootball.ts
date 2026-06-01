/**
 * API-Football (api-sports.io) typed helpers.
 * Used by the sync-scores edge function and any future client-side fallback.
 * Free tier: 100 req/day — cache aggressively. League 1 = FIFA World Cup.
 */
const BASE = 'https://v3.football.api-sports.io';

export interface ApiFixture {
  fixture: {
    id: number;
    status: { short: string; elapsed: number | null };
    date: string;
  };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
}

export interface ApiFixturesResponse {
  response: ApiFixture[];
}

/** Map API-Football status codes → our match status. */
export function mapStatus(short: string): 'scheduled' | 'live' | 'finished' {
  if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(short)) return 'live';
  if (['FT', 'AET', 'PEN', 'PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(short))
    return 'finished';
  return 'scheduled';
}

function headers(apiKey: string) {
  return { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': 'v3.football.api-sports.io' };
}

export async function fetchLiveFixtures(
  apiKey: string,
  season = 2026,
  league = 1,
): Promise<ApiFixture[]> {
  const res = await fetch(
    `${BASE}/fixtures?live=all&league=${league}&season=${season}`,
    { headers: headers(apiKey) },
  );
  if (!res.ok) throw new Error(`API-Football ${res.status}`);
  const json = (await res.json()) as ApiFixturesResponse;
  return json.response ?? [];
}

export async function fetchFixtures(
  apiKey: string,
  season = 2026,
  league = 1,
): Promise<ApiFixture[]> {
  const res = await fetch(`${BASE}/fixtures?league=${league}&season=${season}`, {
    headers: headers(apiKey),
  });
  if (!res.ok) throw new Error(`API-Football ${res.status}`);
  const json = (await res.json()) as ApiFixturesResponse;
  return json.response ?? [];
}

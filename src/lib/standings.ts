import type { Match } from './database.types';

export interface StandingRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

/**
 * Compute a group standings table from finished matches.
 * `teamIds` seeds the table so all four teams appear even before any result.
 */
export function computeStandings(
  teamIds: string[],
  matches: Match[],
): StandingRow[] {
  const table = new Map<string, StandingRow>();
  for (const id of teamIds) {
    table.set(id, {
      teamId: id,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      points: 0,
    });
  }

  for (const m of matches) {
    if (m.status !== 'finished') continue;
    if (m.home_score == null || m.away_score == null) continue;
    if (!m.home_team_id || !m.away_team_id) continue;
    const home = table.get(m.home_team_id);
    const away = table.get(m.away_team_id);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.goalsFor += m.home_score;
    home.goalsAgainst += m.away_score;
    away.goalsFor += m.away_score;
    away.goalsAgainst += m.home_score;

    if (m.home_score > m.away_score) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (m.home_score < m.away_score) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    }
  }

  for (const row of table.values()) {
    row.goalDiff = row.goalsFor - row.goalsAgainst;
  }

  // Tiebreak (simplified): points → goal diff → goals for → name order.
  return Array.from(table.values()).sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      a.teamId.localeCompare(b.teamId),
  );
}

/**
 * Pick the standings to trust for a group. The official football-data
 * `standings` table has correct FIFA tiebreaks (H2H) but can go **stale**: its
 * snapshot is taken from the upstream standings endpoint, which lags the live
 * scores — e.g. a goal in the 90th minute updates the match but not yet the
 * standings, and once the match is finished nothing re-syncs them, so the row
 * can stay frozen on an earlier scoreline (counting a win as a draw).
 *
 * So: use the official rows only when their aggregates **agree** with the
 * standings recomputed from the actual finished matches (always the source of
 * truth). On any mismatch — a stale/wrong official row — fall back to the
 * match-derived table, which can never disagree with the scores users see.
 * Self-healing: the moment the official sync catches up, it's used again (for
 * its better tiebreaks).
 */
export function reconcileStandings(
  officialRows: StandingRow[] | undefined,
  teamIds: string[],
  matches: Match[],
): StandingRow[] {
  const computed = computeStandings(teamIds, matches);
  if (!officialRows || officialRows.length !== computed.length) return computed;

  const byId = new Map(computed.map((r) => [r.teamId, r]));
  const consistent = officialRows.every((o) => {
    const c = byId.get(o.teamId);
    return (
      !!c &&
      c.played === o.played &&
      c.points === o.points &&
      c.goalsFor === o.goalsFor &&
      c.goalsAgainst === o.goalsAgainst
    );
  });
  return consistent ? officialRows : computed;
}

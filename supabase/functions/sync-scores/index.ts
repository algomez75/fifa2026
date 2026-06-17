// supabase/functions/sync-scores/index.ts
//
// Live score sync from football-data.org. Runs every 60s via pg_cron.
// Self-throttles: only calls the API when a match is in its in-progress
// window, protecting the rate limit.
//
// v2 (2026-06-11):
//  - Guard also matches finished-with-null-scores rows so late score backfills
//    land (the free tier publishes fullTime minutes AFTER FINISHED — v1 wrote
//    `finished` + nulls once and never re-fetched: the GS-A1 bug).
//  - Per-match detail fetch (/v4/matches/{id}) for in-window matches → upserts
//    goal events (scorer, minute, running score) into `match_events`, which
//    drives the in-app celebration + the goal push notifications.
//  - Honest update accounting + per-step errors in the response.
//
// Matches are linked via matches.api_football_fixture_id == football-data
// match id (populated by scripts/map-footballdata.mjs). Goal teams map via
// teams.fd_team_id.
//
// Deploy:  supabase functions deploy sync-scores
// Secret:  supabase secrets set FOOTBALLDATA_TOKEN=xxxx
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { dedupe, loadDevices, sendExpoPush, wants, type PushMessage } from '../_shared/push.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TOKEN = Deno.env.get('FOOTBALLDATA_TOKEN') ?? '';
const FD_BASE = 'https://api.football-data.org/v4';

function mapStatus(s: string): 'live' | 'finished' | null {
  if (s === 'IN_PLAY' || s === 'PAUSED' || s === 'SUSPENDED') return 'live';
  if (s === 'FINISHED' || s === 'AWARDED') return 'finished';
  return null; // SCHEDULED/TIMED/POSTPONED/CANCELLED → don't touch
}

/** Live period the client uses for the half-time label + the ticking clock.
 *  Half-time is football-data status PAUSED; otherwise derive 1H/2H/ET/PEN. */
function mapPeriod(
  fdStatus: string,
  minute: number | null,
  duration: string | null,
): string | null {
  if (fdStatus === 'PAUSED') return 'HT';
  if (fdStatus === 'IN_PLAY') {
    if (duration === 'PENALTY_SHOOTOUT') return 'PEN';
    if (duration === 'EXTRA_TIME') return 'ET';
    return typeof minute === 'number' && minute > 45 ? '2H' : '1H';
  }
  return null; // scheduled / finished
}

async function fd(path: string): Promise<any | null> {
  const res = await fetch(`${FD_BASE}${path}`, { headers: { 'X-Auth-Token': TOKEN } });
  if (!res.ok) return null;
  return res.json();
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1. Guard: any match in its in-progress window? Two cases:
  //    a) not finished and kicking off between 4h ago and 10min from now
  //    b) finished but scores still NULL (API backfills fullTime late) within 12h
  const now = Date.now();
  const windowStart = new Date(now - 4 * 60 * 60_000).toISOString();
  const backfillStart = new Date(now - 12 * 60 * 60_000).toISOString();
  // Keep re-fetching a match for ~1.5h after full-time so the FINAL team stats
  // (football-data finalizes possession/shots a few minutes after FINISHED)
  // land in match_details.
  const recentFinish = new Date(now - 3.5 * 60 * 60_000).toISOString();
  // 90 min ahead: football-data publishes starting lineups ~1h before kickoff.
  const soon = new Date(now + 90 * 60_000).toISOString();
  const { data: active, error: gErr } = await supabase
    .from('matches')
    .select('id, api_football_fixture_id, status, home_score')
    .or(
      `and(status.neq.finished,kickoff_utc.lte.${soon},kickoff_utc.gte.${windowStart}),` +
        `and(status.eq.finished,kickoff_utc.gte.${recentFinish}),` +
        `and(status.eq.finished,home_score.is.null,kickoff_utc.gte.${backfillStart})`,
    );
  if (gErr) return Response.json({ error: gErr.message }, { status: 500 });
  if (!active || active.length === 0)
    return Response.json({ skipped: 'no matches in progress window', updated: 0 });
  if (!TOKEN)
    return Response.json({ skipped: 'FOOTBALLDATA_TOKEN not set', updated: 0 });

  const errors: string[] = [];

  // 2. Fetch the full WC match list (one request) → statuses + scores.
  const json = await fd('/competitions/WC/matches');
  if (!json)
    return Response.json({ error: 'football-data list fetch failed' }, { status: 502 });
  const matches = (json.matches ?? []) as any[];

  let updated = 0;
  for (const m of matches) {
    const status = mapStatus(m.status);
    if (!status) continue;
    const ft = m.score?.fullTime ?? {};
    const ht = m.score?.halfTime ?? {};
    const pen = m.score?.penalties ?? {};
    const minute = typeof m.minute === 'number' ? m.minute : null;
    const { data: rows, error } = await supabase
      .from('matches')
      .update({
        home_score: ft.home ?? null,
        away_score: ft.away ?? null,
        home_score_ht: ht.home ?? null,
        away_score_ht: ht.away ?? null,
        home_score_penalties: pen.home ?? null,
        away_score_penalties: pen.away ?? null,
        minute,
        period: mapPeriod(m.status, minute, m.score?.duration ?? null),
        status,
      })
      .eq('api_football_fixture_id', m.id)
      .select('id');
    if (error) errors.push(`update ${m.id}: ${error.message}`);
    else if (rows && rows.length > 0) updated++;
  }

  // 3. Per-match detail for in-window matches → goal events with scorer names.
  //    (goals[].team.id maps to teams.fd_team_id; seq = index in goals[].)
  const { data: teams } = await supabase
    .from('teams')
    .select('id, fd_team_id, name, flag_emoji')
    .not('fd_team_id', 'is', null);
  const teamByFdId = new Map((teams ?? []).map((t: any) => [t.fd_team_id, t.id]));
  const teamById = new Map((teams ?? []).map((t: any) => [t.id, t]));
  const teamName = (id: string | null) => (id ? teamById.get(id)?.name ?? 'TBD' : 'TBD');
  const teamFlag = (id: string | null) => (id ? teamById.get(id)?.flag_emoji ?? '' : '');

  // Player lookup (normalized name within team) so events carry player_id and
  // the app can show the scorer's photo avatar.
  const normName = (s: string | null | undefined) =>
    (s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  // PostgREST caps responses at 1000 rows — page through all ~1250 players.
  const allPlayers: { id: number; team_id: string; name: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data: page } = await supabase
      .from('players')
      .select('id, team_id, name')
      .order('id')
      .range(from, from + 999);
    allPlayers.push(...((page ?? []) as typeof allPlayers));
    if (!page || page.length < 1000) break;
  }
  const playersByTeam = new Map<string, { id: number; key: string }[]>();
  for (const p of allPlayers ?? []) {
    const list = playersByTeam.get(p.team_id) ?? [];
    list.push({ id: p.id, key: normName(p.name) });
    playersByTeam.set(p.team_id, list);
  }
  const resolvePlayer = (teamId: string | null, name: string | null) => {
    if (!teamId || !name) return null;
    const key = normName(name);
    const list = playersByTeam.get(teamId) ?? [];
    const exact = list.filter((p) => p.key === key);
    if (exact.length === 1) return exact[0].id;
    // abbreviated / partial: surname tail (+ first initial when present)
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

  // Goals detected as genuinely new this run → pushed inline at the end so the
  // alert lands in seconds instead of waiting for the notify-dispatcher cron.
  interface NewGoal {
    matchId: string;
    homeTeamId: string | null;
    awayTeamId: string | null;
    teamId: string | null;
    playerName: string | null;
    minute: number | null;
    scoreHome: number | null;
    scoreAway: number | null;
  }
  const newGoals: NewGoal[] = [];

  let events = 0;
  for (const row of active) {
    if (!row.api_football_fixture_id) continue;
    const detail = await fd(`/matches/${row.api_football_fixture_id}`);
    if (!detail) {
      errors.push(`detail ${row.api_football_fixture_id}: fetch failed`);
      continue;
    }
    // Rich detail (lineups, formations, stats, referee) → match_details.
    const mapPlayers = (teamId: string | null, list: any[] | undefined) =>
      (list ?? []).map((p) => ({
        name: p.name ?? null,
        position: p.position ?? null,
        shirtNumber: p.shirtNumber ?? null,
        fd_id: p.id ?? null,
        player_id: resolvePlayer(teamId, p.name ?? null),
        captain: p.captain ?? null,
      }));
    const homeTeamId = teamByFdId.get(detail.homeTeam?.id) ?? null;
    const awayTeamId = teamByFdId.get(detail.awayTeam?.id) ?? null;
    const statsOf = (t: any) =>
      t?.statistics && typeof t.statistics === 'object' && !('msg' in t.statistics)
        ? t.statistics
        : null;
    if (detail.homeTeam?.lineup?.length || statsOf(detail.homeTeam)) {
      const { error: dErr } = await supabase.from('match_details').upsert(
        {
          match_id: row.id,
          home_formation: detail.homeTeam?.formation ?? null,
          away_formation: detail.awayTeam?.formation ?? null,
          home_lineup: mapPlayers(homeTeamId, detail.homeTeam?.lineup),
          away_lineup: mapPlayers(awayTeamId, detail.awayTeam?.lineup),
          home_bench: mapPlayers(homeTeamId, detail.homeTeam?.bench),
          away_bench: mapPlayers(awayTeamId, detail.awayTeam?.bench),
          home_stats: statsOf(detail.homeTeam),
          away_stats: statsOf(detail.awayTeam),
          substitutions: (detail.substitutions ?? []).map((s: any) => ({
            minute: s.minute ?? null,
            team_id: teamByFdId.get(s.team?.id) ?? null,
            out_name: s.playerOut?.name ?? null,
            in_name: s.playerIn?.name ?? null,
          })),
          referee: detail.referees?.[0]?.name ?? null,
          referees: (detail.referees ?? []).map((r: any) => ({
            name: r.name ?? null,
            type: r.type ?? null,
            nationality: r.nationality ?? null,
          })),
          attendance: detail.attendance ?? null,
          injury_time: detail.injuryTime ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'match_id' },
      );
      if (dErr) errors.push(`details ${row.id}: ${dErr.message}`);
    }

    const goals = (detail.goals ?? []) as any[];
    const bookings = (detail.bookings ?? []) as any[];

    // ── Goals: reconcile match_events to MIRROR the upstream goals[] ──────────
    // Insert-only (the old behaviour) left VAR-annulled goals behind forever.
    // Now we diff by a stable natural key (minute|team|scorer): added goals are
    // inserted (+queued for an inline push), annulled goals are deleted, and the
    // common "nothing changed" case writes nothing (no realtime churn).
    const natKey = (e: { minute: number | null; team_id: string | null; player_name: string | null }) =>
      `${e.minute ?? ''}|${e.team_id ?? ''}|${normName(e.player_name)}`;

    const desired = goals.map((g, i) => {
      const teamId = teamByFdId.get(g.team?.id) ?? null;
      return {
        match_id: row.id,
        seq: i,
        type: 'goal',
        minute: typeof g.minute === 'number' ? g.minute : null,
        team_id: teamId,
        player_id: resolvePlayer(teamId, g.scorer?.name ?? null),
        player_name: g.scorer?.name ?? null,
        score_home: g.score?.home ?? null,
        score_away: g.score?.away ?? null,
      };
    });

    const { data: existing } = await supabase
      .from('match_events')
      .select('id, minute, team_id, player_name, pushed, created_at')
      .eq('match_id', row.id)
      .eq('type', 'goal');
    const existingByKey = new Map((existing ?? []).map((e: any) => [natKey(e), e]));
    const desiredKeys = new Set(desired.map(natKey));

    // Only touch the table when the set of goals actually changed (rare).
    const setChanged =
      desired.length !== (existing ?? []).length ||
      desired.some((d) => !existingByKey.has(natKey(d)));
    if (setChanged) {
      // Full replace, preserving id / pushed / created_at for goals that
      // persist (so they neither re-push nor re-celebrate, and re-indexing
      // after an annulment can't violate the (match_id,seq) unique key).
      await supabase.from('match_events').delete().eq('match_id', row.id).eq('type', 'goal');
      const insertRows = desired.map((d) => {
        const prior = existingByKey.get(natKey(d));
        return {
          ...d,
          ...(prior ? { id: prior.id, created_at: prior.created_at } : {}),
          pushed: prior?.pushed ?? false,
        };
      });
      if (insertRows.length) {
        const { error } = await supabase.from('match_events').insert(insertRows);
        if (error) errors.push(`goals ${row.id}: ${error.message}`);
        else events += insertRows.length;
      }
      // Brand-new goals (no prior row) → queue an inline push.
      for (const d of desired) {
        if (!existingByKey.has(natKey(d))) {
          newGoals.push({
            matchId: row.id,
            homeTeamId,
            awayTeamId,
            teamId: d.team_id,
            playerName: d.player_name,
            minute: d.minute,
            scoreHome: d.score_home,
            scoreAway: d.score_away,
          });
        }
      }
    }
    // Annulled goals no longer in `desired` are removed by the full replace
    // above; nothing extra to push (per product decision — silent correction).

    // ── Cards: insert-only (seq 1000+; rescinded cards are vanishingly rare) ──
    if (bookings.length) {
      const cardRows = bookings.map((b, i) => {
        const teamId = teamByFdId.get(b.team?.id) ?? null;
        return {
          match_id: row.id,
          seq: 1000 + i,
          type: b.card === 'RED' || b.card === 'YELLOW_RED' ? 'red' : 'yellow',
          minute: typeof b.minute === 'number' ? b.minute : null,
          team_id: teamId,
          player_id: resolvePlayer(teamId, b.player?.name ?? null),
          player_name: b.player?.name ?? null,
          score_home: null,
          score_away: null,
        };
      });
      const { error } = await supabase
        .from('match_events')
        .upsert(cardRows, { onConflict: 'match_id,seq', ignoreDuplicates: true });
      if (error) errors.push(`cards ${row.id}: ${error.message}`);
    }
  }

  // ── Inline goal pushes: send the instant a goal is detected (no cron hop) ───
  // Deduped globally via match_events.pushed, shared with notify-dispatcher's
  // backstop, so a goal is never pushed twice.
  if (newGoals.length) {
    const { devices } = await loadDevices(supabase);
    if (devices.length) {
      const messages: PushMessage[] = [];
      for (const g of newGoals) {
        if (!g.homeTeamId || !g.awayTeamId) continue;
        const who = g.playerName ?? teamName(g.teamId) ?? 'Goal';
        const min = g.minute != null ? ` ${g.minute}'` : '';
        const flag = teamFlag(g.teamId);
        const score =
          g.scoreHome != null && g.scoreAway != null
            ? ` — ${teamName(g.homeTeamId)} ${g.scoreHome}–${g.scoreAway} ${teamName(g.awayTeamId)}`
            : ` — ${teamName(g.homeTeamId)} vs ${teamName(g.awayTeamId)}`;
        for (const d of devices) {
          if (!wants(d, g.homeTeamId, g.awayTeamId)) continue;
          messages.push({
            to: d.token,
            title: `${d.lang === 'es' ? '⚽ ¡GOL!' : '⚽ GOAL!'}${flag ? ' ' + flag : ''}`,
            body: `${who}${min}${score}`,
            sound: 'default',
            data: { matchId: g.matchId, type: 'goal' },
          });
        }
      }
      if (messages.length) {
        await sendExpoPush(dedupe(messages));
        // Mark every still-unpushed goal of these matches as pushed so the
        // dispatcher backstop doesn't re-send the same alerts.
        const matchIds = [...new Set(newGoals.map((g) => g.matchId))];
        await supabase
          .from('match_events')
          .update({ pushed: true })
          .in('match_id', matchIds)
          .eq('type', 'goal')
          .eq('pushed', false);
      }
    }
  }

  // 4. Golden boot — refresh the tournament top scorers when anything changed.
  if (updated > 0 || events > 0) {
    const scorers = await fd('/competitions/WC/scorers?limit=20');
    const list = (scorers?.scorers ?? []) as any[];
    if (list.length) {
      const rows = list.map((s, i) => {
        const teamId = teamByFdId.get(s.team?.id) ?? null;
        return {
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
      const del = await supabase.from('top_scorers').delete().gte('rank', 0);
      if (del.error) errors.push(`scorers clear: ${del.error.message}`);
      const ins = await supabase.from('top_scorers').insert(rows);
      if (ins.error) errors.push(`scorers insert: ${ins.error.message}`);
    }
  }

  // 5. Official group standings (correct FIFA tiebreaks + recent form). Refresh
  //    whenever scores moved; map football-data team ids → our team ids.
  let standingsRows = 0;
  if (updated > 0 || events > 0) {
    const st = await fd('/competitions/WC/standings');
    const groups = (st?.standings ?? []) as any[];
    const rows: any[] = [];
    for (const g of groups) {
      if (g.type && g.type !== 'TOTAL') continue; // ignore HOME/AWAY splits
      const letter = (g.group ?? '').replace(/^Group\s*/i, '').trim() || null;
      if (!letter) continue;
      for (const r of (g.table ?? []) as any[]) {
        const teamId = teamByFdId.get(r.team?.id) ?? null;
        if (!teamId) continue;
        rows.push({
          group_letter: letter,
          team_id: teamId,
          position: r.position ?? 0,
          played: r.playedGames ?? 0,
          won: r.won ?? 0,
          draw: r.draw ?? 0,
          lost: r.lost ?? 0,
          goals_for: r.goalsFor ?? 0,
          goals_against: r.goalsAgainst ?? 0,
          goal_difference: r.goalDifference ?? 0,
          points: r.points ?? 0,
          form: r.form ?? null,
          updated_at: new Date().toISOString(),
        });
      }
    }
    if (rows.length) {
      const { error } = await supabase
        .from('standings')
        .upsert(rows, { onConflict: 'group_letter,team_id' });
      if (error) errors.push(`standings: ${error.message}`);
      else standingsRows = rows.length;
    }
  }

  return Response.json({
    updated,
    eventsSeen: events,
    standingsRows,
    inWindow: active.length,
    scanned: matches.length,
    errors: errors.length ? errors : undefined,
  });
});

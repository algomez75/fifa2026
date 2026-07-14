// supabase/functions/sync-scores/index.ts
//
// Live score sync from football-data.org. Runs every ~5s via pg_cron.
// Self-throttles: only calls the API when a match is in its in-progress window.
//
// Real-time design (2026-06-22):
//  - CHEAP FAST PATH: the single `/competitions/WC/matches` LIST call already
//    carries score + minute + period + HT score for every match. That drives the
//    clock / score / half-time at the full ~5s cadence for one request. We only
//    write a row when something actually changed (no needless realtime churn on
//    finished matches every tick).
//  - BOUNDED DETAIL: the expensive per-match `/matches/{id}` fetch (scorer name,
//    lineups, stats, cards) is gated — fetched only on a score change / kickoff,
//    while a scorer is still unattributed, or every DETAIL_FLOOR ms — so detail
//    cost does NOT scale with the fast cadence. Player paging is lazy (only when
//    a detail fetch will run).
//  - LIVE-MOMENT PUSHES: kickoff (actual), half-time (+score), second-half —
//    emitted here (the only place holding prior+new period this tick), deduped
//    per device via push_sent, fired only from a known prior live state.
//  - Goal dedupe: match_events are reconciled IN PLACE (upsert by (match_id,seq),
//    never resetting pushed/created_at; deletes gated by the authoritative score)
//    + an atomic claim on the push → exactly one goal push, immune to overlapping
//    invocations and transient short feeds.
//  - fd() is now 429/5xx aware (one bounded retry) and reports rate429 so we can
//    see headroom; a long Retry-After sheds the detail loop (scores still update
//    from the cheap LIST data already in hand).
//
// Deploy:  supabase functions deploy sync-scores
// Secret:  supabase secrets set FOOTBALLDATA_TOKEN=xxxx
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { dedupe, loadDevices, sendExpoPush, wants, type PushMessage } from '../_shared/push.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TOKEN = Deno.env.get('FOOTBALLDATA_TOKEN') ?? '';
const FD_BASE = 'https://api.football-data.org/v4';
// The backend also hosts club-league rows (migration 027+): top_scorers PK is
// (competition_id, rank) and standings PK is (competition_id, team_id), both
// NOT NULL. Every write here must carry — and every wipe must be scoped to —
// the WC competition, or inserts fail and other competitions' rows get nuked.
const WC_COMPETITION_ID = 'world-cup-2026';

// Detail-fetch floors: live matches refresh stats/cards faster than idle
// (pre-kickoff lineups / post-finish stats finalization).
const DETAIL_FLOOR_LIVE = 20_000;
const DETAIL_FLOOR_IDLE = 60_000;

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // football-data fetch with bounded retry + rate-limit awareness. On 429 we
  // honour a short Retry-After once; a long one flips `rateLimited` so the tick
  // sheds its detail loop (the cheap LIST already gave us scores/clock/period).
  let rate429 = 0;
  let rateLimited = false;
  async function fd(path: string): Promise<any | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await fetch(`${FD_BASE}${path}`, { headers: { 'X-Auth-Token': TOKEN } });
      } catch (_e) {
        return null; // network blip — next tick covers it
      }
      if (res.ok) return res.json();
      if (res.status === 429) {
        rate429++;
        const ra = Number(res.headers.get('Retry-After') ?? '0');
        if (attempt === 0 && ra > 0 && ra <= 8) {
          await sleep(ra * 1000);
          continue;
        }
        if (ra > 8) rateLimited = true;
        return null;
      }
      if (res.status >= 500 && attempt === 0) {
        await sleep(500);
        continue;
      }
      return null;
    }
    return null;
  }

  // 1. Guard: any match in its in-progress window?
  //    a) not finished and kicking off between 4h ago and 90min ahead
  //    b) finished within 3.5h (final stats finalize a few min after FINISHED)
  //    c) finished but scores still NULL (API backfills fullTime late) within 12h
  const now = Date.now();
  // 12h lookback (not 4h): we now only write matches in this window, so a match
  // that went live + finished during a long outage must still fall inside it to
  // be rescued. In normal operation matches are marked finished within ~2h, so
  // almost nothing non-finished sits past 4h — the window stays small.
  const windowStart = new Date(now - 12 * 60 * 60_000).toISOString();
  const backfillStart = new Date(now - 12 * 60 * 60_000).toISOString();
  const recentFinish = new Date(now - 3.5 * 60 * 60_000).toISOString();
  const soon = new Date(now + 90 * 60_000).toISOString();
  const { data: active, error: gErr } = await supabase
    .from('matches')
    .select(
      'id, api_football_fixture_id, status, home_team_id, away_team_id, home_score, away_score, home_score_ht, away_score_ht, home_score_penalties, away_score_penalties, minute, period, injury_time, kickoff_utc, delay_status, original_kickoff_utc, updated_at',
    )
    .or(
      `and(status.neq.finished,kickoff_utc.lte.${soon},kickoff_utc.gte.${windowStart}),` +
        `and(status.eq.finished,kickoff_utc.gte.${recentFinish}),` +
        `and(status.eq.finished,home_score.is.null,kickoff_utc.gte.${backfillStart}),` +
        // Undecided knockout fixtures (any date): pull them in so the LIST loop
        // can fill home/away_team_id the moment football-data assigns the matchup.
        // Match while EITHER side is still null — football-data assigns homeTeam
        // first, so keying on home-only dropped the row the instant home filled
        // and the away side (e.g. a best-third) never got written.
        `and(stage.neq.group,status.neq.finished,or(home_team_id.is.null,away_team_id.is.null))`,
    );
  if (gErr) return Response.json({ error: gErr.message }, { status: 500 });
  if (!active || active.length === 0)
    return Response.json({ skipped: 'no matches in progress window', updated: 0 });
  if (!TOKEN)
    return Response.json({ skipped: 'FOOTBALLDATA_TOKEN not set', updated: 0 });

  const errors: string[] = [];

  // 2. Fetch the full WC match list (one cheap request) → statuses + scores +
  //    minute + period + HT score for ALL matches.
  const json = await fd('/competitions/WC/matches');
  if (!json)
    return Response.json({ error: 'football-data list fetch failed', rate429 }, { status: 502 });
  const fdMatches = (json.matches ?? []) as any[];

  // Prior DB state, keyed by football-data fixture id (only matches in our sync
  // window — we never touch long-finished rows, killing per-tick churn).
  const priorByFixture = new Map<number, any>();
  for (const r of active) {
    if (r.api_football_fixture_id != null) priorByFixture.set(r.api_football_fixture_id, r);
  }

  // What the LIST loop learns this tick:
  const needsDetail = new Set<string>(); // score changed / went live → grab scorer now
  const liveNow = new Set<string>(); // match is currently live (new status)
  let scoreOrStatusChanged = false; // → refresh standings
  interface Transition {
    row: any;
    type: 'kickoff_live' | 'halftime' | 'secondhalf' | 'fulltime' | 'delay';
    htHome?: number | null;
    htAway?: number | null;
    homeScore?: number | null;
    awayScore?: number | null;
    /** For type 'delay': the new timing state (delayed|postponed|suspended|cancelled). */
    delayStatus?: string;
  }
  const transitions: Transition[] = [];
  // Authoritative goal count per match (full-time score = ft.home + ft.away from
  // the LIST). Gates the annulment delete in the detail loop so a transient short
  // /matches/{id} goals[] can never wipe good rows.
  const expectedGoalsByMatch = new Map<string, number>();

  // Teams lookup (small) — needed in the loop to translate football-data's
  // homeTeam.id → our team id (knockout matchup fill), and later for push labels.
  const { data: teams } = await supabase
    .from('teams')
    .select('id, fd_team_id, name, flag_emoji')
    .not('fd_team_id', 'is', null);
  const teamByFdId = new Map((teams ?? []).map((t: any) => [t.fd_team_id, t.id]));
  const teamById = new Map((teams ?? []).map((t: any) => [t.id, t]));
  const teamName = (id: string | null) => (id ? teamById.get(id)?.name ?? 'TBD' : 'TBD');
  const teamFlag = (id: string | null) => (id ? teamById.get(id)?.flag_emoji ?? '' : '');

  let updated = 0;
  for (const m of fdMatches) {
    const prior = priorByFixture.get(m.id);
    if (!prior) continue; // outside our sync window → leave it alone

    // Knockout matchup fill: football-data assigns homeTeam/awayTeam the moment a
    // fixture is decided (even while still TIMED). Translate fd ids → ours and
    // fill only a side that's still null (never overwrite a known id with null).
    const fillHome = teamByFdId.get(m.homeTeam?.id) ?? null;
    const fillAway = teamByFdId.get(m.awayTeam?.id) ?? null;
    const teamFill: Record<string, string> = {};
    if (fillHome && prior.home_team_id == null) teamFill.home_team_id = fillHome;
    if (fillAway && prior.away_team_id == null) teamFill.away_team_id = fillAway;
    const nextHomeTeam = teamFill.home_team_id ?? prior.home_team_id ?? null;
    const nextAwayTeam = teamFill.away_team_id ?? prior.away_team_id ?? null;

    const status = mapStatus(m.status);

    // ── Kickoff refresh + delay state ──────────────────────────────────────────
    // football-data POSTPONED/SUSPENDED/CANCELLED are first-class statuses and it
    // updates `utcDate` in place on a reschedule (no original/new pair). "Delayed"
    // (running late) isn't a status — we infer it (past kickoff, not started).
    // Cause = the provider status; neither API exposes a free-text reason.
    const fdKickoff = typeof m.utcDate === 'string' ? m.utcDate : null;
    const storedKickoff = (prior.kickoff_utc ?? null) as string | null;
    const kickoffMoved = !!(
      fdKickoff &&
      storedKickoff &&
      Math.abs(Date.parse(fdKickoff) - Date.parse(storedKickoff)) > 60_000
    );
    const effectiveKickoff = kickoffMoved ? fdKickoff : storedKickoff;
    const kickoffFields: Record<string, any> = {};
    if (kickoffMoved) {
      kickoffFields.kickoff_utc = fdKickoff;
      // Snapshot the original kickoff ONCE so the app can show "moved from X".
      if (prior.original_kickoff_utc == null) kickoffFields.original_kickoff_utc = storedKickoff;
    }
    let delayStatus: string | null = null;
    if (m.status === 'POSTPONED') delayStatus = 'postponed';
    else if (m.status === 'CANCELLED') delayStatus = 'cancelled';
    else if (m.status === 'SUSPENDED') delayStatus = 'suspended';
    else if (!status && effectiveKickoff && Date.parse(effectiveKickoff) < now - 15 * 60_000) {
      delayStatus = 'delayed'; // TIMED/SCHEDULED but >15 min past kickoff & not live
    }
    const priorDelay = (prior.delay_status ?? null) as string | null;
    // Queue a delay push on a NEW delay state (deduped per delay_status downstream).
    if (delayStatus && delayStatus !== priorDelay) {
      const sc = (m.score?.fullTime ?? {}) as any;
      transitions.push({
        row: prior,
        type: 'delay',
        delayStatus,
        homeScore: sc.home ?? null,
        awayScore: sc.away ?? null,
      });
    }

    if (!status) {
      // Not live/finished (SCHEDULED/TIMED/POSTPONED/CANCELLED) → no live scores to
      // write, but persist a newly-known knockout matchup, a moved kickoff, and the
      // delay state. Written only on a real change; next tick → no churn.
      const upd: Record<string, any> = { ...teamFill, ...kickoffFields };
      if (delayStatus !== priorDelay) upd.delay_status = delayStatus;
      if (Object.keys(upd).length) {
        const { error } = await supabase
          .from('matches')
          .update(upd)
          .eq('api_football_fixture_id', m.id);
        if (error) errors.push(`fill ${m.id}: ${error.message}`);
        else updated++;
      }
      continue;
    }

    const ft = m.score?.fullTime ?? {};
    const ht = m.score?.halfTime ?? {};
    const pen = m.score?.penalties ?? {};
    const minute = typeof m.minute === 'number' ? m.minute : null;
    const period = mapPeriod(m.status, minute, m.score?.duration ?? null);
    // Real announced added minutes — carried in the cheap LIST every ~5s. Lets
    // the client clock CAP the "+n" stoppage at reality instead of inventing it.
    const injuryTime = typeof m.injuryTime === 'number' ? m.injuryTime : null;
    const next = {
      home_score: ft.home ?? null,
      away_score: ft.away ?? null,
      home_score_ht: ht.home ?? null,
      away_score_ht: ht.away ?? null,
      home_score_penalties: pen.home ?? null,
      away_score_penalties: pen.away ?? null,
      minute,
      period,
      injury_time: injuryTime,
      status,
      // Clears any prior delay when a match goes live/finished; 'suspended' while
      // football-data status is SUSPENDED (status stays 'live', score frozen).
      delay_status: delayStatus,
      ...teamFill,
      ...kickoffFields,
    };

    if (status === 'live') liveNow.add(prior.id);
    expectedGoalsByMatch.set(prior.id, (next.home_score ?? 0) + (next.away_score ?? 0));

    const priorStatus = prior.status as string;
    const priorPeriod = (prior.period ?? null) as string | null;

    // Live-moment transitions — fire only from a KNOWN prior live state so a
    // cold first-observation (null → HT) can't false-positive.
    if (priorStatus === 'scheduled' && status === 'live') {
      transitions.push({ row: prior, type: 'kickoff_live' });
    }
    if (priorPeriod === '1H' && period === 'HT') {
      transitions.push({ row: prior, type: 'halftime', htHome: next.home_score_ht, htAway: next.away_score_ht });
    }
    if (priorPeriod === 'HT' && period === '2H') {
      transitions.push({ row: prior, type: 'secondhalf' });
    }
    // Full time — fire from the 5s live path (vs ~30s dispatcher) so the result
    // push lands fast. Only from a KNOWN prior live state + non-null scores; the
    // result_pushed claim below stops the dispatcher backstop from re-sending.
    if (priorStatus === 'live' && status === 'finished' && next.home_score != null && next.away_score != null) {
      transitions.push({
        row: prior,
        type: 'fulltime',
        homeScore: next.home_score,
        awayScore: next.away_score,
      });
    }

    const scoreChanged =
      next.home_score !== (prior.home_score ?? null) ||
      next.away_score !== (prior.away_score ?? null);
    if (scoreChanged || (priorStatus === 'scheduled' && status === 'live')) needsDetail.add(prior.id);
    if (scoreChanged || status !== priorStatus) scoreOrStatusChanged = true;

    // Skip the write entirely when nothing changed → no needless realtime event
    // (and the clock anchor only advances on a real change; the client tween
    // smooths the gap).
    const noChange =
      next.home_score === (prior.home_score ?? null) &&
      next.away_score === (prior.away_score ?? null) &&
      next.home_score_ht === (prior.home_score_ht ?? null) &&
      next.away_score_ht === (prior.away_score_ht ?? null) &&
      next.home_score_penalties === (prior.home_score_penalties ?? null) &&
      next.away_score_penalties === (prior.away_score_penalties ?? null) &&
      next.minute === (prior.minute ?? null) &&
      next.period === priorPeriod &&
      next.injury_time === (prior.injury_time ?? null) &&
      nextHomeTeam === (prior.home_team_id ?? null) &&
      nextAwayTeam === (prior.away_team_id ?? null) &&
      next.status === priorStatus &&
      delayStatus === priorDelay &&
      !kickoffMoved;
    if (noChange) continue;

    const { error } = await supabase
      .from('matches')
      .update(next)
      .eq('api_football_fixture_id', m.id);
    if (error) errors.push(`update ${m.id}: ${error.message}`);
    else updated++;
  }

  // 3. Decide which matches actually need a DETAIL fetch this tick.
  const activeIds = active.map((r: any) => r.id);
  const { data: mdRows } = await supabase
    .from('match_details')
    .select('match_id, updated_at')
    .in('match_id', activeIds);
  const detailAt = new Map<string, number>(
    (mdRows ?? []).map((r: any) => [r.match_id, Date.parse(r.updated_at)]),
  );
  // Matches with a goal whose scorer hasn't landed yet → keep polling for ≤60s.
  const { data: unsettledRows } = await supabase
    .from('match_events')
    .select('match_id')
    .eq('type', 'goal')
    .is('player_name', null)
    .gte('created_at', new Date(now - 60_000).toISOString())
    .in('match_id', activeIds);
  const unsettled = new Set<string>((unsettledRows ?? []).map((r: any) => r.match_id));

  const detailTargets = (active as any[]).filter((row) => {
    if (!row.api_football_fixture_id) return false;
    if (needsDetail.has(row.id) || unsettled.has(row.id)) return true;
    // Far-future fixtures (e.g. undecided knockouts pulled in only to fill their
    // matchup) have no lineup/stats yet → never fetch their detail.
    if (
      !liveNow.has(row.id) &&
      row.kickoff_utc &&
      Date.parse(row.kickoff_utc) > now + 100 * 60_000
    )
      return false;
    const age = detailAt.has(row.id) ? now - (detailAt.get(row.id) as number) : Infinity;
    const floor = liveNow.has(row.id) ? DETAIL_FLOOR_LIVE : DETAIL_FLOOR_IDLE;
    return age >= floor;
  });
  // Under a long rate-limit cool-down, shed the detail loop — scores/clock/period
  // already updated from the cheap LIST data above.
  const doDetailLoop = !rateLimited && detailTargets.length > 0;

  // Player lookup (normalized name within team) so events carry player_id and
  // the app can show the scorer's photo. PAGED LAZILY — only when we'll fetch
  // detail this tick, so cheap fast-path ticks stay cheap.
  const normName = (s: string | null | undefined) =>
    (s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const playersByTeam = new Map<string, { id: number; key: string }[]>();
  if (doDetailLoop) {
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
    for (const p of allPlayers) {
      const list = playersByTeam.get(p.team_id) ?? [];
      list.push({ id: p.id, key: normName(p.name) });
      playersByTeam.set(p.team_id, list);
    }
  }
  const resolvePlayer = (teamId: string | null, name: string | null) => {
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

  // Home/away team ids for matches whose detail we processed → labels the inline
  // goal push.
  const matchTeams = new Map<string, { homeTeamId: string | null; awayTeamId: string | null }>();

  let events = 0;
  if (doDetailLoop) {
    for (const row of detailTargets) {
      const detail = await fd(`/matches/${row.api_football_fixture_id}`);
      if (!detail) {
        errors.push(`detail ${row.api_football_fixture_id}: fetch failed`);
        continue;
      }
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
      matchTeams.set(row.id, { homeTeamId, awayTeamId });
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
      } else {
        // No lineup/stats yet (pre-kickoff) — still advance the detail-fetch
        // marker so the age gate doesn't re-fetch this match every tick. Touches
        // only updated_at; preserves any lineups already stored.
        await supabase
          .from('match_details')
          .upsert(
            { match_id: row.id, updated_at: new Date().toISOString() },
            { onConflict: 'match_id' },
          );
      }

      const goals = (detail.goals ?? []) as any[];
      const bookings = (detail.bookings ?? []) as any[];

      // ── Goals: reconcile match_events IN PLACE to mirror upstream goals[] ────
      // No delete-all + reinsert. That pattern reset pushed/created_at whenever an
      // overlapping 5s invocation (or a transient short detail fetch) saw a partial
      // goal set mid-rebuild — making every prior goal look brand-new and re-firing
      // its push. Instead we UPSERT by the existing (match_id,seq) key and NEVER
      // write `pushed`/`created_at`, so a settled goal can't be re-pushed or
      // re-celebrated; annulment deletes are gated by the authoritative score.

      // Running score per goal — computed from the goals[] ORDER so a goal has a
      // stable score the instant it appears (football-data leaves goals[].score
      // NULL during live play and backfills it later). Prefer the feed's score
      // once present, else the computed tally (each goal +1 to its team).
      let runH = 0;
      let runA = 0;
      const desired = goals.map((g, i) => {
        const teamId = teamByFdId.get(g.team?.id) ?? null;
        if (teamId && teamId === homeTeamId) runH++;
        else if (teamId && teamId === awayTeamId) runA++;
        const hasScore = g.score?.home != null && g.score?.away != null;
        return {
          match_id: row.id,
          seq: i,
          type: 'goal',
          minute: typeof g.minute === 'number' ? g.minute : null,
          team_id: teamId,
          player_id: resolvePlayer(teamId, g.scorer?.name ?? null),
          player_name: g.scorer?.name ?? null,
          score_home: hasScore ? g.score.home : runH,
          score_away: hasScore ? g.score.away : runA,
        };
      });

      const { data: existing } = await supabase
        .from('match_events')
        .select('id, seq, minute, team_id, player_id, player_name, score_home, score_away')
        .eq('match_id', row.id)
        .eq('type', 'goal');
      const existingBySeq = new Map<number, any>((existing ?? []).map((e: any) => [e.seq, e]));

      // Upsert only NEW or CHANGED goals (no churn on identical ticks). Because the
      // payload omits `pushed`/`created_at`/`id`, an ON CONFLICT update leaves them
      // intact (no re-push) and an insert takes the column defaults (false / now()).
      const toUpsert = desired.filter((d) => {
        const cur = existingBySeq.get(d.seq);
        return (
          !cur ||
          cur.minute !== d.minute ||
          cur.team_id !== d.team_id ||
          cur.player_id !== d.player_id ||
          cur.player_name !== d.player_name ||
          cur.score_home !== d.score_home ||
          cur.score_away !== d.score_away
        );
      });
      if (toUpsert.length) {
        const { error } = await supabase
          .from('match_events')
          .upsert(toUpsert, { onConflict: 'match_id,seq' });
        if (error) errors.push(`goals ${row.id}: ${error.message}`);
        else events += toUpsert.length;
      }

      // Delete annulled goals (a row beyond the current goals[] count) ONLY when
      // the feed's goal count agrees with the authoritative score — so a transient
      // short detail fetch can't wipe good rows. A real VAR annulment drops the
      // score too, so the counts agree and the stale row is removed in place.
      const expected = expectedGoalsByMatch.get(row.id);
      if (
        expected != null &&
        desired.length === expected &&
        (existing ?? []).some((e: any) => e.seq >= desired.length)
      ) {
        const { error } = await supabase
          .from('match_events')
          .delete()
          .eq('match_id', row.id)
          .eq('type', 'goal')
          .gte('seq', desired.length)
          .lt('seq', 1000);
        if (error) errors.push(`goals-del ${row.id}: ${error.message}`);
      }

      // ── Cards: insert-only (seq 1000+; rescinded cards are vanishingly rare) ─
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
  }

  // ── Pushes: load devices once, then (a) inline goal push, (b) live moments ──
  const { devices } = await loadDevices(supabase);

  // (a) Inline goal push — ATOMIC claim (`UPDATE ... WHERE pushed=false RETURNING`)
  //     so concurrent ticks / the dispatcher backstop can't double-send. We push
  //     ONLY what we claimed, for matches whose detail we processed this tick.
  if (devices.length && matchTeams.size) {
    const claimIds = [...matchTeams.keys()];
    const { data: claimed } = await supabase
      .from('match_events')
      .update({ pushed: true })
      .in('match_id', claimIds)
      .eq('type', 'goal')
      .eq('pushed', false)
      .select('match_id, minute, team_id, player_name, score_home, score_away');
    const messages: PushMessage[] = [];
    for (const ev of claimed ?? []) {
      const t = matchTeams.get(ev.match_id);
      if (!t || !t.homeTeamId || !t.awayTeamId) continue;
      const who = ev.player_name ?? teamName(ev.team_id) ?? 'Goal';
      const min = ev.minute != null ? ` ${ev.minute}'` : '';
      const flag = teamFlag(ev.team_id);
      const score =
        ev.score_home != null && ev.score_away != null
          ? ` — ${teamName(t.homeTeamId)} ${ev.score_home}–${ev.score_away} ${teamName(t.awayTeamId)}`
          : ` — ${teamName(t.homeTeamId)} vs ${teamName(t.awayTeamId)}`;
      for (const d of devices) {
        if (!wants(d, t.homeTeamId, t.awayTeamId)) continue;
        messages.push({
          to: d.token,
          title: `${d.lang === 'es' ? '⚽ ¡GOL!' : '⚽ GOAL!'}${flag ? ' ' + flag : ''}`,
          body: `${who}${min}${score}`,
          sound: 'default',
          data: { matchId: ev.match_id, type: 'goal' },
        });
      }
    }
    if (messages.length) await sendExpoPush(dedupe(messages));
  }

  // (b) Live-moment pushes — kickoff / half-time (+score) / second-half. Deduped
  //     per device via push_sent(token,match_id,type); these types are
  //     sync-scores-exclusive so they never race the dispatcher.
  if (devices.length && transitions.length) {
    const transMatchIds = [...new Set(transitions.map((tr) => tr.row.id))];
    const { data: sentRows } = await supabase
      .from('push_sent')
      .select('token, match_id, type')
      .in('match_id', transMatchIds)
      .in('type', [
        'kickoff_live',
        'halftime',
        'secondhalf',
        'fulltime',
        'delay-delayed',
        'delay-postponed',
        'delay-suspended',
        'delay-cancelled',
      ]);
    const sent = new Set((sentRows ?? []).map((s: any) => `${s.token}:${s.match_id}:${s.type}`));
    const messages: PushMessage[] = [];
    const sentLog: { token: string; match_id: string; type: string }[] = [];
    for (const tr of transitions) {
      const homeId = tr.row.home_team_id as string | null;
      const awayId = tr.row.away_team_id as string | null;
      const h = teamName(homeId);
      const a = teamName(awayId);
      for (const d of devices) {
        if (!wants(d, homeId, awayId)) continue;
        const pushType = tr.type === 'delay' ? `delay-${tr.delayStatus}` : tr.type;
        const key = `${d.token}:${tr.row.id}:${pushType}`;
        if (sent.has(key)) continue;
        sent.add(key);
        const es = d.lang === 'es';
        let title: string;
        let body: string;
        if (tr.type === 'kickoff_live') {
          title = es ? '🔴 ¡Arrancó el partido!' : '🔴 Kickoff!';
          body = es ? `${h} vs ${a} — ¡ya están en vivo! ⚽` : `${h} vs ${a} — they're live! ⚽`;
        } else if (tr.type === 'halftime') {
          const sc = tr.htHome != null && tr.htAway != null ? `${tr.htHome}–${tr.htAway}` : null;
          title = es ? '⏸️ Medio tiempo' : '⏸️ Half-time';
          body = sc
            ? `${h} ${sc} ${a}`
            : es
              ? `Descanso — ${h} vs ${a}`
              : `Half-time — ${h} vs ${a}`;
        } else if (tr.type === 'secondhalf') {
          title = es ? '▶️ Segundo tiempo' : '▶️ Second half';
          body = es ? `¡Comienza el 2º tiempo! ${h} vs ${a}` : `Second half underway! ${h} vs ${a}`;
        } else if (tr.type === 'delay') {
          // Cause = the provider status (no free-text reason from the API); the
          // app shows the exact new time (kickoff_utc was refreshed this tick).
          const ds = tr.delayStatus;
          if (ds === 'postponed') {
            title = es ? '⏱️ Partido aplazado' : '⏱️ Match postponed';
            body = es ? `${h} vs ${a} — nueva hora en la app` : `${h} vs ${a} — new time in the app`;
          } else if (ds === 'suspended') {
            const sc =
              tr.homeScore != null && tr.awayScore != null ? `${tr.homeScore}–${tr.awayScore}` : null;
            title = es ? '⏸️ Partido suspendido' : '⏸️ Match suspended';
            body = sc ? `${h} ${sc} ${a}` : `${h} vs ${a}`;
          } else if (ds === 'cancelled') {
            title = es ? '❌ Partido cancelado' : '❌ Match cancelled';
            body = `${h} vs ${a}`;
          } else {
            title = es ? '⏱️ Partido retrasado' : '⏱️ Match delayed';
            body = es ? `${h} vs ${a} — empieza pronto` : `${h} vs ${a} — starting soon`;
          }
        } else {
          // fulltime
          const sc =
            tr.homeScore != null && tr.awayScore != null ? `${tr.homeScore}–${tr.awayScore}` : null;
          title = es ? '🏁 Final del partido' : '🏁 Full time';
          body = sc ? `${h} ${sc} ${a}` : es ? `Final — ${h} vs ${a}` : `Full time — ${h} vs ${a}`;
        }
        messages.push({
          to: d.token,
          title,
          body,
          sound: 'default',
          data: { matchId: tr.row.id, type: tr.type },
        });
        sentLog.push({ token: d.token, match_id: tr.row.id, type: pushType });
      }
    }
    if (messages.length) {
      await sendExpoPush(dedupe(messages));
      await supabase
        .from('push_sent')
        .upsert(sentLog, { onConflict: 'token,match_id,type', ignoreDuplicates: true });
    }
    // Claim full-time matches so the dispatcher backstop (which gates on
    // result_pushed=false) never re-sends the result push. Send first, then
    // mark — a send failure leaves the flag false for the backstop to retry.
    const ftIds = [...new Set(transitions.filter((tr) => tr.type === 'fulltime').map((tr) => tr.row.id))];
    if (ftIds.length) {
      await supabase.from('matches').update({ result_pushed: true }).in('id', ftIds).eq('result_pushed', false);
    }
  }

  // 4. Golden boot — refresh top scorers only when goal/card events changed.
  if (events > 0) {
    const scorers = await fd('/competitions/WC/scorers?limit=20');
    const list = (scorers?.scorers ?? []) as any[];
    if (list.length) {
      const rows = list.map((s, i) => {
        const teamId = teamByFdId.get(s.team?.id) ?? null;
        return {
          competition_id: WC_COMPETITION_ID,
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
      // Wipe ONLY the WC rows (never other competitions'), then reinsert.
      const del = await supabase
        .from('top_scorers')
        .delete()
        .eq('competition_id', WC_COMPETITION_ID);
      if (del.error) errors.push(`scorers clear: ${del.error.message}`);
      const ins = await supabase.from('top_scorers').insert(rows);
      if (ins.error) errors.push(`scorers insert: ${ins.error.message}`);
    }
  }

  // 5. Official standings — refresh only when a score or status actually moved
  //    (not on every minute tick).
  let standingsRows = 0;
  if (scoreOrStatusChanged) {
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
          competition_id: WC_COMPETITION_ID,
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
      // PK is (competition_id, team_id) since migration 027 — the old
      // 'group_letter,team_id' target no longer matches a unique constraint.
      const { error } = await supabase
        .from('standings')
        .upsert(rows, { onConflict: 'competition_id,team_id' });
      if (error) errors.push(`standings: ${error.message}`);
      else standingsRows = rows.length;
    }
  }

  return Response.json({
    updated,
    eventsSeen: events,
    detailFetches: doDetailLoop ? detailTargets.length : 0,
    transitions: transitions.length,
    standingsRows,
    inWindow: active.length,
    scanned: fdMatches.length,
    rate429,
    rateLimited: rateLimited || undefined,
    errors: errors.length ? errors : undefined,
  });
});

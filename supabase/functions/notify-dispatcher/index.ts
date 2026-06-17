// supabase/functions/notify-dispatcher/index.ts
//
// Push notification dispatcher. Runs every minute via pg_cron.
//
// Sends ONE push per unique device token (never per user row — anonymous-first
// auth means one phone can sit on many user_settings rows sharing a token; the
// old per-row loop sent up to 28 copies). Four match moments + challenges:
//   1. 📋 Lineups out      — ~1h before kickoff, once match_details has the XI
//   2. ⚽ Kickoff soon      — within the device's notify_minutes_before window
//   3. ⚽ GOAL!             — per goal, with scorer + running score
//   4. 🏁 Full time        — at the final whistle
//   5. ⚔️ Challenge events  — received / accepted / declined (per recipient)
//
// Dedupe: lineup/kickoff via push_sent(token,match,type); goals via
// match_events.pushed; results via matches.result_pushed; challenges via
// notifications.pushed. A final (token,title,body) net guards against any
// same-run duplicate.
//
// Deploy:  supabase functions deploy notify-dispatcher
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { dedupe, loadDevices, sendExpoPush, wants, type PushMessage } from '../_shared/push.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // ── 1. Collapse user_settings rows into unique devices (by token) ──────────
  const { devices, users } = await loadDevices(supabase);
  if (!users.length) {
    return Response.json({ sent: 0, reason: 'no subscribers' });
  }

  const now = Date.now();
  // 180 min ahead: lineups land ~1h before, and prediction reminders fire
  // ~30-180 min before kickoff.
  const horizon = new Date(now + 180 * 60_000).toISOString();

  const { data: matches } = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, kickoff_utc, status, home_score, away_score, result_pushed')
    .or(`and(status.eq.scheduled,kickoff_utc.lte.${horizon}),and(status.eq.finished,result_pushed.eq.false)`);

  const { data: teams } = await supabase.from('teams').select('id, name, flag_emoji');
  const teamMap = new Map<string, any>((teams ?? []).map((t: any) => [t.id, t]));
  const teamName = (id: string) => teamMap.get(id)?.name ?? 'TBD';
  const teamFlag = (id: string) => teamMap.get(id)?.flag_emoji ?? '';

  const scheduled = (matches ?? []).filter((m: any) => m.status === 'scheduled');
  const scheduledIds = scheduled.map((m: any) => m.id);

  // Which scheduled matches already have a published lineup?
  const lineupReady = new Set<string>();
  if (scheduledIds.length) {
    const { data: details } = await supabase
      .from('match_details')
      .select('match_id, home_lineup')
      .in('match_id', scheduledIds);
    for (const d of details ?? []) {
      if (Array.isArray(d.home_lineup) && d.home_lineup.length > 0) lineupReady.add(d.match_id);
    }
  }

  // Already-sent lineup/kickoff/predict alerts, keyed by `${token}:${match}:${type}`.
  const alreadySent = new Set<string>();
  if (scheduledIds.length) {
    const { data: sent } = await supabase
      .from('push_sent')
      .select('token, match_id, type')
      .in('match_id', scheduledIds);
    for (const s of sent ?? []) alreadySent.add(`${s.token}:${s.match_id}:${s.type}`);
  }

  // Display names (for personalized nudges) + which users already predicted the
  // upcoming matches, so prediction reminders only target those who haven't.
  const { data: profs } = await supabase.from('profiles').select('user_id, display_name');
  const nameByUser = new Map<string, string | null>(
    (profs ?? []).map((p: any) => [p.user_id, p.display_name]),
  );
  const predicted = new Set<string>();
  if (scheduledIds.length) {
    const { data: preds } = await supabase
      .from('predictions')
      .select('user_id, match_id')
      .in('match_id', scheduledIds);
    for (const p of preds ?? []) predicted.add(`${p.user_id}:${p.match_id}`);
  }

  const messages: PushMessage[] = [];
  const sentLog: { token: string; match_id: string; type: string }[] = [];
  const resultPushedIds: string[] = [];

  for (const m of matches ?? []) {
    const label = `${teamFlag(m.home_team_id)} ${teamName(m.home_team_id)} vs ${teamFlag(m.away_team_id)} ${teamName(m.away_team_id)}`.trim();
    const minsToKick = Math.round((new Date(m.kickoff_utc).getTime() - now) / 60_000);

    for (const d of devices) {
      if (!wants(d, m.home_team_id, m.away_team_id)) continue;
      const es = d.lang === 'es';

      if (m.status === 'scheduled') {
        // 📋 Lineup released (~1h before) — once per device per match.
        const lineupKey = `${d.token}:${m.id}:lineup`;
        if (lineupReady.has(m.id) && !alreadySent.has(lineupKey)) {
          messages.push({
            to: d.token,
            title: es ? '📋 Alineaciones confirmadas' : '📋 Lineups are out',
            body: es ? `${label} — mira el once inicial` : `${label} — see the starting XI`,
            sound: 'default',
            data: { matchId: m.id, type: 'lineup' },
          });
          alreadySent.add(lineupKey);
          sentLog.push({ token: d.token, match_id: m.id, type: 'lineup' });
        }

        // ⚽ Kickoff soon — once per device per match.
        const kickoffKey = `${d.token}:${m.id}:kickoff`;
        if (minsToKick > 0 && minsToKick <= d.minsBefore && !alreadySent.has(kickoffKey)) {
          messages.push({
            to: d.token,
            title: es ? '⚽ Comienza pronto' : '⚽ Kickoff soon',
            body:
              minsToKick <= 1
                ? es
                  ? `¡${label} está por comenzar! 🔥`
                  : `${label} is kicking off now! 🔥`
                : es
                  ? `${label} comienza en ${minsToKick} min 🔥`
                  : `${label} kicks off in ${minsToKick} min 🔥`,
            sound: 'default',
            data: { matchId: m.id, type: 'kickoff' },
          });
          alreadySent.add(kickoffKey);
          sentLog.push({ token: d.token, match_id: m.id, type: 'kickoff' });
        }

        // 🔮 Prediction reminder — once, ~30-180 min before kickoff, only to a
        // user who hasn't predicted this match. Personalized by display name.
        const predictKey = `${d.token}:${m.id}:predict`;
        if (
          minsToKick > 30 &&
          minsToKick <= 180 &&
          !alreadySent.has(predictKey) &&
          !predicted.has(`${d.user_id}:${m.id}`)
        ) {
          const nm = nameByUser.get(d.user_id);
          const hi = nm ? `${nm}, ` : '';
          const h = teamName(m.home_team_id);
          const a = teamName(m.away_team_id);
          messages.push({
            to: d.token,
            title: es ? '🔮 ¿Tu predicción?' : '🔮 Your prediction?',
            body: es
              ? `${hi}aún no predices ${h} vs ${a} — ¡hazlo antes del pitazo! 🎯`
              : `${hi}you haven't predicted ${h} vs ${a} — do it before kickoff! 🎯`,
            sound: 'default',
            data: { matchId: m.id, type: 'predict' },
          });
          alreadySent.add(predictKey);
          sentLog.push({ token: d.token, match_id: m.id, type: 'predict' });
        }
      } else if (
        m.status === 'finished' &&
        !m.result_pushed &&
        m.home_score != null &&
        m.away_score != null
      ) {
        // 🏁 Full time — deduped globally via matches.result_pushed.
        messages.push({
          to: d.token,
          title: es ? '🏁 Final del partido' : '🏁 Full time',
          body: `${teamName(m.home_team_id)} ${m.home_score}–${m.away_score} ${teamName(m.away_team_id)}`,
          sound: 'default',
          data: { matchId: m.id, type: 'result' },
        });
      }
    }

    // Flag the result as pushed once scores exist, even if nobody subscribes,
    // so the row stops matching the query next tick.
    if (
      m.status === 'finished' &&
      !m.result_pushed &&
      m.home_score != null &&
      m.away_score != null
    ) {
      resultPushedIds.push(m.id);
    }
  }

  // ── 2. Goals → one push per device, deduped globally via match_events.pushed
  const { data: goalEvents } = await supabase
    .from('match_events')
    .select('id, match_id, minute, team_id, player_name, score_home, score_away')
    .eq('pushed', false)
    .eq('type', 'goal')
    .order('created_at', { ascending: true })
    .limit(100);

  const goalEventIds: string[] = [];
  if (goalEvents && goalEvents.length) {
    const { data: goalMatches } = await supabase
      .from('matches')
      .select('id, home_team_id, away_team_id')
      .in('id', [...new Set(goalEvents.map((e: any) => e.match_id))]);
    const matchById = new Map<string, any>((goalMatches ?? []).map((m: any) => [m.id, m]));

    for (const ev of goalEvents) {
      const m = matchById.get(ev.match_id);
      goalEventIds.push(ev.id);
      if (!m) continue;
      const who = ev.player_name ?? teamName(ev.team_id) ?? 'Goal';
      const minute = ev.minute != null ? ` ${ev.minute}'` : '';
      const flag = teamFlag(ev.team_id);
      const score =
        ev.score_home != null && ev.score_away != null
          ? ` — ${teamName(m.home_team_id)} ${ev.score_home}–${ev.score_away} ${teamName(m.away_team_id)}`
          : ` — ${teamName(m.home_team_id)} vs ${teamName(m.away_team_id)}`;

      for (const d of devices) {
        if (!wants(d, m.home_team_id, m.away_team_id)) continue;
        messages.push({
          to: d.token,
          title: `${d.lang === 'es' ? '⚽ ¡GOL!' : '⚽ GOAL!'}${flag ? ' ' + flag : ''}`,
          body: `${who}${minute}${score}`,
          sound: 'default',
          data: { matchId: ev.match_id, type: 'goal', eventId: ev.id },
        });
      }
    }
  }

  // ── 3. Challenge events → the recipient's device(s) ────────────────────────
  const tokensByUser = new Map<string, string[]>();
  for (const u of users) {
    const arr = tokensByUser.get(u.user_id) ?? [];
    arr.push(u.expo_push_token as string);
    tokensByUser.set(u.user_id, arr);
  }

  const { data: pending } = await supabase
    .from('notifications')
    .select('id, user_id, type, actor_name, challenge_id, match_id')
    .eq('pushed', false)
    .order('created_at', { ascending: true })
    .limit(200);

  const pushedIds: string[] = [];
  for (const n of pending ?? []) {
    const tokens = tokensByUser.get(n.user_id) ?? [];
    pushedIds.push(n.id); // mark regardless so unknown/orphan rows stop scanning
    if (!tokens.length) continue;
    const actor = n.actor_name ?? 'A player';
    let title: string;
    let body: string;
    if (n.type === 'challenge_received') {
      title = '⚔️ New challenge';
      body = `${actor} challenged you`;
    } else if (n.type === 'challenge_accepted') {
      title = '✅ Challenge accepted';
      body = `${actor} accepted your challenge`;
    } else if (n.type === 'challenge_declined') {
      title = '🚫 Challenge declined';
      body = `${actor} declined your challenge`;
    } else {
      continue;
    }
    for (const to of new Set(tokens)) {
      messages.push({
        to,
        title,
        body,
        sound: 'default',
        data: { type: 'challenge', notifId: n.id, challengeId: n.challenge_id, matchId: n.match_id },
      });
    }
  }

  // ── 3.5 Leaderboard nudge → fired when a match finished recently, capped at
  //        ~twice a day per device (AM/PM bucket). Personalized: the user's rank
  //        + the current leader, to lure them back to play. Deep-links to the
  //        leaderboard tab.
  const since2h = new Date(now - 2 * 60 * 60_000).toISOString();
  const { data: recentFin } = await supabase
    .from('matches')
    .select('id')
    .eq('status', 'finished')
    .gte('updated_at', since2h)
    .limit(1);
  let leaderboardNudges = 0;
  if ((recentFin?.length ?? 0) > 0) {
    const d0 = new Date(now);
    const bucket = `lb-${d0.toISOString().slice(0, 10)}-${d0.getUTCHours() < 12 ? 'AM' : 'PM'}`;
    const { data: lbSent } = await supabase
      .from('push_sent')
      .select('token')
      .eq('match_id', bucket)
      .eq('type', 'leaderboard');
    const lbSentTokens = new Set((lbSent ?? []).map((s: any) => s.token));
    const { data: lb } = await supabase.rpc('get_leaderboard');
    const rows = (lb ?? []) as { user_id: string; display_name: string; points: number }[];
    if (rows.length) {
      const leader = rows[0];
      const rankByUser = new Map(rows.map((r, i) => [r.user_id, i + 1]));
      const sentThisRun = new Set<string>();
      for (const d of devices) {
        if (!(d.notifyAll || d.notifyFavorites)) continue; // respect opt-out
        if (lbSentTokens.has(d.token) || sentThisRun.has(d.token)) continue;
        const es = d.lang === 'es';
        const rank = rankByUser.get(d.user_id);
        const nm = nameByUser.get(d.user_id);
        const hi = nm ? `${nm}, ` : '';
        let body: string;
        if (rank === 1) {
          body = es
            ? `${hi}¡vas #1 con ${leader.points} pts! 👑 Defiende tu corona`
            : `${hi}you're #1 with ${leader.points} pts! 👑 Defend your crown`;
        } else if (rank) {
          body = es
            ? `${hi}vas #${rank}. ${leader.display_name} lidera con ${leader.points} pts — ¡remonta! 🚀`
            : `${hi}you're #${rank}. ${leader.display_name} leads with ${leader.points} pts — catch up! 🚀`;
        } else {
          body = es
            ? `${leader.display_name} lidera con ${leader.points} pts. ¡Haz tus predicciones y entra al ranking! 🔮`
            : `${leader.display_name} leads with ${leader.points} pts. Predict and join the ranking! 🔮`;
        }
        messages.push({
          to: d.token,
          title: es ? '🏆 Tabla de posiciones' : '🏆 Leaderboard',
          body,
          sound: 'default',
          data: { type: 'leaderboard' },
        });
        sentLog.push({ token: d.token, match_id: bucket, type: 'leaderboard' });
        sentThisRun.add(d.token);
        leaderboardNudges++;
      }
    }
  }

  // ── 4. Final dedupe net: never send identical (token,title,body) twice ─────
  const unique = dedupe(messages);
  const deadTokens = await sendExpoPush(unique);

  if (pushedIds.length) {
    await supabase.from('notifications').update({ pushed: true }).in('id', pushedIds);
  }
  if (goalEventIds.length) {
    await supabase.from('match_events').update({ pushed: true }).in('id', goalEventIds);
  }
  if (resultPushedIds.length) {
    await supabase.from('matches').update({ result_pushed: true }).in('id', resultPushedIds);
  }
  if (sentLog.length) {
    await supabase
      .from('push_sent')
      .upsert(sentLog, { onConflict: 'token,match_id,type', ignoreDuplicates: true });
  }
  if (deadTokens.length) {
    await supabase.from('user_settings').update({ expo_push_token: null }).in('expo_push_token', deadTokens);
  }

  return Response.json({
    devices: devices.length,
    sent: unique.length,
    goals: goalEventIds.length,
    results: resultPushedIds.length,
    lineupAlerts: sentLog.filter((s) => s.type === 'lineup').length,
    kickoffs: sentLog.filter((s) => s.type === 'kickoff').length,
    predictReminders: sentLog.filter((s) => s.type === 'predict').length,
    leaderboardNudges,
    deadTokens: deadTokens.length,
  });
});

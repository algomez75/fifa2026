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

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

interface PushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: Record<string, unknown>;
}

/** One physical device: a unique Expo token with the merged preferences of
 *  every user_settings row that shares it. */
interface Device {
  token: string;
  user_id: string; // a representative row (for challenge mapping)
  notifyAll: boolean;
  notifyFavorites: boolean;
  favs: Set<string>;
  minsBefore: number;
  lang: 'en' | 'es';
}

/** Sends in batches of 100 and returns tokens Expo reports as dead
 *  (DeviceNotRegistered) so they can be pruned from user_settings. */
async function sendExpoPush(messages: PushMessage[]): Promise<string[]> {
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      });
      const json = await res.json();
      const tickets = (json?.data ?? []) as { status: string; details?: { error?: string } }[];
      tickets.forEach((t, idx) => {
        if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') {
          dead.push(batch[idx].to);
        }
      });
    } catch (_e) {
      // network hiccup — the cron retries naturally next minute
    }
  }
  return dead;
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // ── 1. Collapse user_settings rows into unique devices (by token) ──────────
  const { data: users } = await supabase
    .from('user_settings')
    .select('user_id, favorite_team_ids, notify_favorites, notify_all, notify_minutes_before, language, expo_push_token')
    .not('expo_push_token', 'is', null);

  if (!users || users.length === 0) {
    return Response.json({ sent: 0, reason: 'no subscribers' });
  }

  const deviceByToken = new Map<string, Device>();
  for (const u of users) {
    const token = u.expo_push_token as string;
    let d = deviceByToken.get(token);
    if (!d) {
      d = {
        token,
        user_id: u.user_id,
        notifyAll: false,
        notifyFavorites: false,
        favs: new Set<string>(),
        minsBefore: 0,
        lang: u.language === 'es' ? 'es' : 'en',
      };
      deviceByToken.set(token, d);
    }
    if (u.notify_all) d.notifyAll = true;
    if (u.notify_favorites) d.notifyFavorites = true;
    for (const f of u.favorite_team_ids ?? []) d.favs.add(f);
    // earliest preferred window across the device's sessions
    d.minsBefore = Math.max(d.minsBefore, u.notify_minutes_before ?? 15);
    if (u.language === 'es') d.lang = 'es';
  }
  const devices = [...deviceByToken.values()];
  const wants = (d: Device, homeId: string, awayId: string) =>
    d.notifyAll || (d.notifyFavorites && (d.favs.has(homeId) || d.favs.has(awayId)));

  const now = Date.now();
  // 90 min ahead so lineups (which land ~1h before) are in range.
  const horizon = new Date(now + 90 * 60_000).toISOString();

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

  // Already-sent lineup/kickoff alerts, keyed by `${token}:${match}:${type}`.
  const alreadySent = new Set<string>();
  if (scheduledIds.length) {
    const { data: sent } = await supabase
      .from('push_sent')
      .select('token, match_id, type')
      .in('match_id', scheduledIds);
    for (const s of sent ?? []) alreadySent.add(`${s.token}:${s.match_id}:${s.type}`);
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

  // ── 4. Final dedupe net: never send identical (token,title,body) twice ─────
  const seen = new Set<string>();
  const unique = messages.filter((msg) => {
    const k = `${msg.to}|${msg.title}|${msg.body}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

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
    deadTokens: deadTokens.length,
  });
});

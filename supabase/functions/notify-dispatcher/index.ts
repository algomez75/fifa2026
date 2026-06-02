// supabase/functions/notify-dispatcher/index.ts
//
// Push notification dispatcher. Runs every minute via pg_cron.
// Sends:
//   1. "starting soon" alerts (per-user notify_minutes_before window)
//   2. final-whistle results
//   3. pending in-app notifications (challenge received / accepted / declined)
// to subscribed Expo push tokens via the Expo Push API.
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

async function sendExpoPush(messages: PushMessage[]) {
  if (!messages.length) return;
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    await fetch(EXPO_PUSH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
  }
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Users with a registered push token.
  const { data: users } = await supabase
    .from('user_settings')
    .select('user_id, favorite_team_ids, notify_favorites, notify_all, notify_minutes_before, expo_push_token')
    .not('expo_push_token', 'is', null);

  if (!users || users.length === 0) {
    return Response.json({ sent: 0, reason: 'no subscribers' });
  }

  const now = Date.now();
  const horizon = new Date(now + 60 * 60_000).toISOString();

  // Matches kicking off within the next hour, plus those just finished.
  const { data: matches } = await supabase
    .from('matches')
    .select('id, home_team_id, away_team_id, kickoff_utc, status, home_score, away_score, updated_at')
    .or(`and(status.eq.scheduled,kickoff_utc.lte.${horizon}),status.eq.finished`);

  const { data: teams } = await supabase.from('teams').select('id, name, flag_emoji');
  const teamMap = new Map((teams ?? []).map((t: any) => [t.id, t]));

  const messages: PushMessage[] = [];

  for (const m of matches ?? []) {
    const home = teamMap.get(m.home_team_id);
    const away = teamMap.get(m.away_team_id);
    const label = `${home?.flag_emoji ?? ''} ${home?.name ?? 'TBD'} vs ${away?.flag_emoji ?? ''} ${away?.name ?? 'TBD'}`.trim();
    const minsToKick = Math.round((new Date(m.kickoff_utc).getTime() - now) / 60_000);

    for (const u of users) {
      const followsTeam =
        u.favorite_team_ids?.includes(m.home_team_id) ||
        u.favorite_team_ids?.includes(m.away_team_id);
      const wants = u.notify_all || (u.notify_favorites && followsTeam);
      if (!wants) continue;

      if (
        m.status === 'scheduled' &&
        minsToKick > 0 &&
        minsToKick <= (u.notify_minutes_before ?? 15) &&
        minsToKick > (u.notify_minutes_before ?? 15) - 1
      ) {
        messages.push({
          to: u.expo_push_token!,
          title: '⚽ Kickoff soon',
          body: `${label} kicks off in ${minsToKick} minutes 🔥`,
          sound: 'default',
          data: { matchId: m.id, type: 'kickoff' },
        });
      } else if (
        m.status === 'finished' &&
        now - new Date(m.updated_at).getTime() < 90_000
      ) {
        messages.push({
          to: u.expo_push_token!,
          title: '🏁 Full time',
          body: `${home?.name ?? 'TBD'} ${m.home_score}–${m.away_score} ${away?.name ?? 'TBD'}`,
          sound: 'default',
          data: { matchId: m.id, type: 'result' },
        });
      }
    }
  }

  // ── pending in-app notifications → device push ─────────────────────────────
  // Challenge events live in `notifications`; push each recipient's unpushed
  // rows once, then mark them so they aren't re-sent.
  const tokenByUser = new Map(
    (users ?? []).map((u: any) => [u.user_id, u.expo_push_token as string]),
  );

  const { data: pending } = await supabase
    .from('notifications')
    .select('id, user_id, type, actor_name, challenge_id, match_id')
    .eq('pushed', false)
    .order('created_at', { ascending: true })
    .limit(200);

  const pushedIds: string[] = [];

  for (const n of pending ?? []) {
    const to = tokenByUser.get(n.user_id);
    if (!to) continue; // recipient has no device token yet — retry later
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
      pushedIds.push(n.id); // unknown type — don't keep rescanning it
      continue;
    }

    messages.push({
      to,
      title,
      body,
      sound: 'default',
      data: { type: 'challenge', notifId: n.id, challengeId: n.challenge_id, matchId: n.match_id },
    });
    pushedIds.push(n.id);
  }

  await sendExpoPush(messages);

  if (pushedIds.length) {
    await supabase.from('notifications').update({ pushed: true }).in('id', pushedIds);
  }

  return Response.json({ sent: messages.length });
});

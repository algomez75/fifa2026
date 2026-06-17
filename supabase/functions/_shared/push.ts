// supabase/functions/_shared/push.ts
//
// Shared Expo push helpers used by both `notify-dispatcher` (kickoff / lineup /
// full-time / challenges + goal backstop) and `sync-scores` (inline goal push
// the instant a goal is detected — no cron hop, so it lands in seconds).
//
// One push per unique device token (anonymous-first auth means one phone can
// own many user_settings rows sharing a token).
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: Record<string, unknown>;
}

/** One physical device: a unique Expo token with the merged preferences of
 *  every user_settings row that shares it. */
export interface Device {
  token: string;
  user_id: string; // a representative row (for challenge mapping)
  notifyAll: boolean;
  notifyFavorites: boolean;
  favs: Set<string>;
  minsBefore: number;
  lang: 'en' | 'es';
}

export interface UserRow {
  user_id: string;
  favorite_team_ids: string[] | null;
  notify_favorites: boolean | null;
  notify_all: boolean | null;
  notify_minutes_before: number | null;
  language: string | null;
  expo_push_token: string | null;
}

/** Sends in batches of 100 and returns tokens Expo reports as dead
 *  (DeviceNotRegistered) so they can be pruned from user_settings. */
export async function sendExpoPush(messages: PushMessage[]): Promise<string[]> {
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
      // network hiccup — the cron retries naturally next tick
    }
  }
  return dead;
}

/** Load every push-enabled user_settings row and collapse them into unique
 *  devices keyed by token (returns the raw rows too, for challenge mapping). */
export async function loadDevices(
  supabase: SupabaseClient,
): Promise<{ devices: Device[]; users: UserRow[] }> {
  const { data } = await supabase
    .from('user_settings')
    .select(
      'user_id, favorite_team_ids, notify_favorites, notify_all, notify_minutes_before, language, expo_push_token',
    )
    .not('expo_push_token', 'is', null);
  const users = (data ?? []) as UserRow[];

  const byToken = new Map<string, Device>();
  for (const u of users) {
    const token = u.expo_push_token as string;
    let d = byToken.get(token);
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
      byToken.set(token, d);
    }
    if (u.notify_all) d.notifyAll = true;
    if (u.notify_favorites) d.notifyFavorites = true;
    for (const f of u.favorite_team_ids ?? []) d.favs.add(f);
    d.minsBefore = Math.max(d.minsBefore, u.notify_minutes_before ?? 15);
    if (u.language === 'es') d.lang = 'es';
  }
  return { devices: [...byToken.values()], users };
}

/** Does this device want alerts for a match (all matches, or a favourite)? */
export function wants(d: Device, homeId: string, awayId: string): boolean {
  return d.notifyAll || (d.notifyFavorites && (d.favs.has(homeId) || d.favs.has(awayId)));
}

/** Drop identical (token,title,body) messages so nothing fires twice per run. */
export function dedupe(messages: PushMessage[]): PushMessage[] {
  const seen = new Set<string>();
  return messages.filter((m) => {
    const k = `${m.to}|${m.title}|${m.body}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

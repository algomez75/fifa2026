import { useEffect, useState } from 'react';

import type { Match } from '@/lib/database.types';

export interface LiveClock {
  /** True while the match is paused for half-time (or another break). */
  isHalfTime: boolean;
  /** Ready-to-render minute, e.g. "67", "45+2", "90+3" — null when unknown. */
  text: string | null;
}

/** Add the in-half stoppage "+n" when the running minute overruns its half. */
function formatMinute(minute: number, period: string | null | undefined): string {
  if (period === '1H' && minute > 45) return `45+${minute - 45}`;
  if ((period === '2H' || period == null) && minute > 90) return `90+${minute - 90}`;
  return String(minute);
}

/**
 * A live match clock that **ticks on the device** instead of waiting for the
 * next ~60s server sync. It anchors on the authoritative `minute` written by
 * sync-scores (re-anchored every time Realtime patches the row) and adds the
 * minutes elapsed locally since `updated_at`; if the provider sent no minute it
 * falls back to time-since-kickoff. Returns a half-time flag so the badge can
 * show "Half Time" while football-data reports PAUSED (`period = 'HT'`).
 *
 * Re-renders once per second while live; a no-op (no interval) otherwise.
 */
export function useLiveClock(match: Match): LiveClock {
  const isLive = match.status === 'live';
  // `now` lives in state (kept impurity out of render) and ticks every second
  // while the match is live.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isLive]);

  const isHalfTime = match.period === 'HT' || match.period === 'BT';
  if (!isLive || isHalfTime) return { isHalfTime, text: null };

  let minute: number | null = null;
  if (typeof match.minute === 'number') {
    const anchorAt = match.updated_at ? new Date(match.updated_at).getTime() : now;
    const drift = Math.max(0, Math.floor((now - anchorAt) / 60_000));
    minute = match.minute + drift;
  } else {
    const kickoff = new Date(match.kickoff_utc).getTime();
    if (now > kickoff) minute = Math.floor((now - kickoff) / 60_000) + 1;
  }

  if (minute == null) return { isHalfTime: false, text: null };
  return { isHalfTime: false, text: formatMinute(Math.max(1, minute), match.period) };
}

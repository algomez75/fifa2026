import { useEffect, useRef, useState } from 'react';

import type { Match } from '@/lib/database.types';

/** Cap interpolation so a dead socket freezes the clock rather than inventing
 *  minute 130 — 3 min covers the longest realistic gap between server syncs. */
const MAX_DRIFT_SEC = 180;

export interface LiveClock {
  /** True while the match is paused for half-time (or another break). */
  isHalfTime: boolean;
  /** Ready-to-render minute, e.g. "67", "45+2", "90+3" — null when unknown. */
  text: string | null;
  /** Progressive match clock with seconds, e.g. "67:23", "45+2:13" — null when
   *  unknown. Ticks every second so the live time feels real (Apple-Sports). */
  clock: string | null;
}

/** Add the in-half stoppage "+n" when the running minute overruns its half. */
function formatMinute(minute: number, period: string | null | undefined): string {
  if (period === '1H' && minute > 45) return `45+${minute - 45}`;
  if ((period === '2H' || period == null) && minute > 90) return `90+${minute - 90}`;
  return String(minute);
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/**
 * A live match clock that **ticks on the device** instead of waiting for the
 * next server sync. It anchors on the authoritative `minute` written by
 * sync-scores and counts up the **device-seconds elapsed since that patch
 * arrived** — never diffing the device clock against the server clock, so a
 * skewed phone clock can't read the minute fast/slow. Re-anchors whenever the
 * server `minute`/`updated_at` changes; if the provider sent no minute it falls
 * back to time-since-kickoff. Returns a half-time flag so the badge can show
 * "Half Time" while football-data reports PAUSED (`period = 'HT'`).
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

  // Record the DEVICE time at which each new server anchor first arrived. Drift
  // is then measured purely as device-elapsed time since receipt — immune to any
  // absolute device/server clock offset.
  const anchorKey = `${match.id}:${match.minute ?? ''}:${match.updated_at ?? ''}`;
  const anchorRef = useRef<{ key: string; seenAt: number }>({ key: '', seenAt: now });
  if (anchorRef.current.key !== anchorKey) {
    anchorRef.current = { key: anchorKey, seenAt: Date.now() };
  }

  const isHalfTime = match.period === 'HT' || match.period === 'BT';
  if (!isLive || isHalfTime) return { isHalfTime, text: null, clock: null };

  // Derive minute AND seconds from the drift since the server anchor, so the
  // clock counts up smoothly between syncs and re-anchors on each patch.
  let minute: number | null = null;
  let seconds = 0;
  if (typeof match.minute === 'number') {
    const driftSec = Math.min(
      MAX_DRIFT_SEC,
      Math.max(0, Math.floor((now - anchorRef.current.seenAt) / 1000)),
    );
    minute = match.minute + Math.floor(driftSec / 60);
    seconds = driftSec % 60;
  } else {
    const kickoff = new Date(match.kickoff_utc).getTime();
    if (now > kickoff) {
      const elapsedSec = Math.floor((now - kickoff) / 1000);
      minute = Math.floor(elapsedSec / 60) + 1;
      seconds = elapsedSec % 60;
    }
  }

  if (minute == null) return { isHalfTime: false, text: null, clock: null };
  const label = formatMinute(Math.max(1, minute), match.period);
  return { isHalfTime: false, text: label, clock: `${label}:${pad2(seconds)}` };
}

import { useEffect, useRef, useState } from 'react';

import type { Match } from '@/lib/database.types';

/** Cap interpolation so a dead socket freezes the clock rather than inventing
 *  minute 130 — 3 min covers the longest realistic gap between server syncs. */
const MAX_DRIFT_SEC = 180;

export interface LiveClock {
  /** True while the match is paused for half-time (or another break). */
  isHalfTime: boolean;
  /** True during the penalty shootout — no running minute to show. */
  isPenalties: boolean;
  /** Ready-to-render minute, e.g. "67", "45+2", "90+3" — null when unknown. */
  text: string | null;
  /** Progressive match clock with seconds, e.g. "67:23", "45+2:13" — null when
   *  unknown. Ticks every second so the live time feels real (Apple-Sports). */
  clock: string | null;
}

/** The regulation end of the current period — the running minute may overrun it
 *  by at most the announced added time. PEN/HT have no running boundary. */
function boundaryFor(period: string | null | undefined, minute: number): number | null {
  if (period === '1H') return 45;
  if (period === '2H' || period == null) return 90;
  if (period === 'ET') return minute > 105 ? 120 : 105; // 1st / 2nd extra-time half
  return null; // PEN / HT / unknown — no running boundary
}

/** Add the in-period stoppage "+n" once the running minute overruns its
 *  boundary, e.g. 47→"45+2", 93→"90+3", 107→"105+2", 122→"120+2". */
function formatMinute(minute: number, boundary: number | null): string {
  if (boundary != null && minute > boundary) return `${boundary}+${minute - boundary}`;
  return String(minute);
}

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/**
 * A live match clock that **ticks on the device** instead of waiting for the
 * next server sync. It anchors on the authoritative `minute` written by
 * sync-scores and counts up the **device-seconds elapsed since that patch
 * arrived** — never diffing the device clock against the server clock, so a
 * skewed phone clock can't read the minute fast/slow. Re-anchors whenever the
 * server `minute` changes; if the provider sent no minute it falls back to
 * time-since-kickoff.
 *
 * Stays true to the real match clock:
 *  - **Never invents stoppage time.** The displayed minute is capped at
 *    `boundary + injury_time` (the real added minutes football-data announced);
 *    with no board yet (`injury_time` null) it holds at the boundary (45/90/…).
 *    So instead of ticking to a fantasy "90+7" it freezes at the announced
 *    "90+4" — which also stops the few-seconds overrun into a pause before the
 *    half-time signal propagates.
 *  - **Freezes on a break.** Returns a half-time flag while football-data
 *    reports PAUSED (`period = 'HT'`) and a penalties flag during the shootout
 *    (`period = 'PEN'`); the badge shows "Half Time" / "Penalties" and no clock.
 *  - **Never steps backward** within a period (guards a rare provider minute
 *    correction); resets cleanly when the period changes.
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
  // absolute device/server clock offset. Keyed on MINUTE only (not updated_at):
  // the set_updated_at trigger bumps updated_at on every write — including
  // injury_time-only / same-minute writes — and re-anchoring on those would
  // reset the ticking seconds to :00. injury_time only feeds the cap (read live
  // below), so it needs no anchor.
  const anchorKey = `${match.id}:${match.minute ?? ''}`;
  const anchorRef = useRef<{ key: string; seenAt: number }>({ key: '', seenAt: now });
  if (anchorRef.current.key !== anchorKey) {
    anchorRef.current = { key: anchorKey, seenAt: Date.now() };
  }

  // Monotonic guard: never show a lower minute within the same period (a rare
  // provider correction would otherwise step the clock backward). Resets on a
  // period change so 1H→2H / regulation→ET start fresh.
  const lastRef = useRef<{ period: string | null; minute: number }>({ period: null, minute: 0 });

  const isHalfTime = match.period === 'HT' || match.period === 'BT';
  const isPenalties = match.period === 'PEN';
  if (!isLive || isHalfTime || isPenalties) {
    return { isHalfTime, isPenalties, text: null, clock: null };
  }

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

  if (minute == null) return { isHalfTime: false, isPenalties: false, text: null, clock: null };
  minute = Math.max(1, minute);

  // Cap the running minute at the REAL added time (boundary + injury_time); with
  // no board yet, cap = boundary. Once we'd overrun it, hold at the cap minute's
  // final second (cap:59) instead of ticking into fantasy stoppage.
  const boundary = boundaryFor(match.period, minute);
  if (boundary != null) {
    const cap = boundary + (typeof match.injury_time === 'number' ? match.injury_time : 0);
    if (minute > cap) {
      minute = cap;
      seconds = 59;
    }
  }

  // Monotonic within the period; reset on a period change.
  if (lastRef.current.period !== (match.period ?? null)) {
    lastRef.current = { period: match.period ?? null, minute };
  } else if (minute < lastRef.current.minute) {
    minute = lastRef.current.minute;
    seconds = 59;
  } else {
    lastRef.current.minute = minute;
  }

  const label = formatMinute(minute, boundary);
  return { isHalfTime: false, isPenalties: false, text: label, clock: `${label}:${pad2(seconds)}` };
}

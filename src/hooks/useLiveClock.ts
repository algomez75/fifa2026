import { useSyncExternalStore } from 'react';

import type { Match } from '@/lib/database.types';

/** Cap interpolation so a dead socket freezes the clock rather than inventing
 *  minute 130 — 3 min covers the longest realistic gap between server syncs. */
const MAX_DRIFT_SEC = 180;

export interface LiveClock {
  /** True during the REGULATION half-time break (paused, before 90'). */
  isHalfTime: boolean;
  /** True during a break in the EXTRA-TIME phase of a knockout — paused after 90'
   *  (before extra time kicks off, or at the extra-time half-time). Shown as
   *  "Extra Time" rather than "Half Time". */
  isExtraTimeBreak: boolean;
  /** True while extra time is being PLAYED (clock ticking 90+ / 105+ / 120+). */
  isExtraTime: boolean;
  /** True during the penalty shootout — no running minute to show. */
  isPenalties: boolean;
  /** Ready-to-render minute, e.g. "67", "45+2", "90+3" — null when unknown. */
  text: string | null;
  /** Progressive match clock with seconds, e.g. "67:23", "45+2:13" — null when
   *  unknown. Ticks every second so the live time feels real (Apple-Sports). */
  clock: string | null;
}

// ── Shared 1s ticker ────────────────────────────────────────────────────────
// One module-level interval drives EVERY live clock so all of them re-render on
// the exact same tick (no per-instance setInterval phase drift). Subscribers
// come and go with mounted LiveBadges; the interval only runs while ≥1 is alive.
const tickListeners = new Set<() => void>();
let tickInterval: ReturnType<typeof setInterval> | null = null;
let tickNow = Date.now();

function subscribeTick(cb: () => void): () => void {
  tickListeners.add(cb);
  if (!tickInterval) {
    tickNow = Date.now(); // refresh on (re)start so the first render isn't stale
    tickInterval = setInterval(() => {
      tickNow = Date.now();
      for (const l of tickListeners) l();
    }, 1000);
  }
  return () => {
    tickListeners.delete(cb);
    if (tickListeners.size === 0 && tickInterval) {
      clearInterval(tickInterval);
      tickInterval = null;
    }
  };
}
const getTickNow = () => tickNow;

// ── Shared anchor ───────────────────────────────────────────────────────────
// The instant a given (match, minute) was FIRST observed on this device, shared
// across every LiveBadge for that match. Drift is measured from this shared
// instant, so a card that mounted 40s ago and one that just mounted both show
// the SAME ticking value (they used to diverge: each recorded its own mount
// time). Keyed by match id → one entry per match (bounded), reset when the
// server minute advances. Stays skew-proof: only ever device-elapsed since the
// shared receipt, never device-vs-server clock diffing.
const anchors = new Map<string, { key: string; seenAt: number }>();

function sharedSeenAt(matchId: string, anchorKey: string): number {
  const a = anchors.get(matchId);
  if (!a || a.key !== anchorKey) {
    const seenAt = Date.now();
    anchors.set(matchId, { key: anchorKey, seenAt });
    return seenAt;
  }
  return a.seenAt;
}

// Shared monotonic floor per match: never show a lower minute within the same
// period (guards a late re-anchor or a rare provider minute correction from
// stepping the clock back). SHARED so it can't itself desync screens — a fresh
// card reads the same floor an older one already advanced. Resets on a period
// change (1H→2H / regulation→ET start fresh).
const progress = new Map<string, { period: string | null; minute: number }>();

function monotonicMinute(matchId: string, period: string | null, minute: number): number {
  const p = progress.get(matchId);
  if (!p || p.period !== period) {
    progress.set(matchId, { period, minute });
    return minute;
  }
  if (minute < p.minute) return p.minute;
  p.minute = minute;
  return minute;
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
 * sync-scores and counts up the device-seconds elapsed since that minute was
 * first seen — never diffing the device clock against the server clock, so a
 * skewed phone clock can't read the minute fast/slow. Falls back to
 * time-since-kickoff if the provider sent no minute.
 *
 * **Synchronized across every screen.** The "first seen" instant and the 1-second
 * tick are both shared at module level, so the SAME match shows the exact same
 * value on the Home hero, Home/Schedule cards, a player's predictions, and the
 * match detail — all ticking in lockstep (previously each card anchored on its
 * own mount time and drifted apart).
 *
 * Stays true to the real match clock:
 *  - **Never invents stoppage time.** The displayed minute is capped at
 *    `boundary + injury_time` (the real added minutes football-data announced);
 *    with no board yet (`injury_time` null) it holds at the boundary. So instead
 *    of ticking to a fantasy "90+7" it freezes at the announced "90+4" — which
 *    also stops the few-seconds overrun into a pause before the half-time signal
 *    propagates.
 *  - **Freezes on a break.** Returns a half-time flag while football-data
 *    reports PAUSED (`period = 'HT'`) and a penalties flag during the shootout
 *    (`period = 'PEN'`); the badge shows "Half Time" / "Penalties" and no clock.
 *  - **Never steps backward** within a period (guards a rare provider minute
 *    correction); resets cleanly when the period changes.
 *
 * Re-renders once per second while live (shared ticker); a no-op when not live.
 */
export function useLiveClock(match: Match): LiveClock {
  const isLive = match.status === 'live';
  // Shared, lockstep 1s tick. Subscribing always keeps hook order stable; the
  // module interval only exists while a LiveBadge (live-only) is mounted.
  const now = useSyncExternalStore(subscribeTick, getTickNow);

  // A PAUSED break (HT/BT) after the 90' regulation in a knockout is part of the
  // extra-time phase (the break before extra time, or the extra-time half-time) —
  // football-data reports it the same way as a regulation half-time (status
  // PAUSED → period 'HT'), so we disambiguate by the minute + knockout stage. We
  // never invent it: a group match always finishes at 90' (never PAUSED there).
  const paused = match.period === 'HT' || match.period === 'BT';
  const isPenalties = match.period === 'PEN';
  const isExtraTimeBreak =
    paused && match.stage !== 'group' && (match.minute ?? 0) >= 90;
  const isHalfTime = paused && !isExtraTimeBreak;
  if (!isLive || paused || isPenalties) {
    return { isHalfTime, isExtraTimeBreak, isExtraTime: false, isPenalties, text: null, clock: null };
  }

  // Derive minute AND seconds from the drift since the SHARED anchor, so the
  // clock counts up smoothly between syncs and every card stays in sync. Keyed
  // on MINUTE only (not updated_at): the set_updated_at trigger bumps updated_at
  // on every write — including injury_time-only / same-minute writes — and
  // re-anchoring on those would reset the ticking seconds to :00. injury_time
  // only feeds the cap (read live below), so it needs no anchor.
  let minute: number | null = null;
  let seconds = 0;
  if (typeof match.minute === 'number') {
    const seenAt = sharedSeenAt(match.id, `${match.id}:${match.minute}`);
    const driftSec = Math.min(MAX_DRIFT_SEC, Math.max(0, Math.floor((now - seenAt) / 1000)));
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

  if (minute == null)
    return {
      isHalfTime: false,
      isExtraTimeBreak: false,
      isExtraTime: false,
      isPenalties: false,
      text: null,
      clock: null,
    };
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

  // Shared monotonic floor — hold the cap minute's final second if we'd step back.
  const held = monotonicMinute(match.id, match.period ?? null, minute);
  if (held > minute) seconds = 59;
  minute = held;

  const label = formatMinute(minute, boundary);
  return {
    isHalfTime: false,
    isExtraTimeBreak: false,
    isExtraTime: match.period === 'ET',
    isPenalties: false,
    text: label,
    clock: `${label}:${pad2(seconds)}`,
  };
}

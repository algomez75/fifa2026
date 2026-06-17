import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import type { Match, MatchEventRow } from '@/lib/database.types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { type GoalEvent, matchEventsKey } from './useMatchEvents';
import { matchesKey } from './useMatches';

export interface MatchEvent {
  matchId: string;
  match: Match;
  /** Present when the goal came with rich data (scorer name, minute). */
  goal?: {
    playerName: string | null;
    minute: number | null;
    teamId: string | null;
    scoreHome: number | null;
    scoreAway: number | null;
  };
}

export interface MatchRealtimeHandlers {
  /** A goal happened on a live match (with scorer info when available). */
  onGoal?: (e: MatchEvent) => void;
  /** A match just transitioned to `finished` (full-time result). */
  onResult?: (e: MatchEvent) => void;
}

/** How long a score-diff goal waits for its rich `match_events` row before
 *  celebrating without a scorer name. */
const GOAL_EVENT_GRACE_MS = 3500;

/**
 * Subscribes to `matches` UPDATEs and `match_events` INSERTs via Supabase
 * Realtime, patches the TanStack caches in place, and fires `onGoal` /
 * `onResult` so the app can celebrate from anywhere.
 *
 * Resilient by design: iOS kills the socket when the app is backgrounded and
 * a failed channel never recovers on its own — so the channel is re-created
 * on error/close (with backoff) and whenever the app returns to the
 * foreground, alongside a cache invalidation to pick up anything missed.
 *
 * Goals can arrive twice (a score bump on `matches` + a rich `match_events`
 * row with the scorer). The rich event wins: a score bump only schedules a
 * fallback celebration after a short grace period, cancelled if the event
 * shows up. No-op until Supabase is configured.
 */
export function useMatchRealtime({ onGoal, onResult }: MatchRealtimeHandlers = {}) {
  const qc = useQueryClient();
  const onGoalRef = useRef(onGoal);
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onGoalRef.current = onGoal;
    onResultRef.current = onResult;
  });

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Score keys (matchId:h-a) already celebrated via a rich event, plus the
    // pending score-diff fallbacks waiting out their grace period.
    const celebratedScores = new Set<string>();
    const pendingFallbacks = new Map<string, ReturnType<typeof setTimeout>>();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 2000;
    let disposed = false;
    let hasConnected = false; // becomes true after the first SUBSCRIBED

    const findMatch = (id: string) =>
      (qc.getQueryData<Match[]>(matchesKey) ?? []).find((m) => m.id === id);

    const onMatchUpdate = (payload: { new: unknown }) => {
      const next = payload.new as Match;
      const prev = findMatch(next.id);

      qc.setQueryData<Match[]>(matchesKey, (old) =>
        (old ?? []).map((m) => (m.id === next.id ? { ...m, ...next } : m)),
      );

      if (next.status === 'live') {
        const scoreUp =
          prev &&
          ((next.home_score ?? 0) > (prev.home_score ?? 0) ||
            (next.away_score ?? 0) > (prev.away_score ?? 0));
        if (!scoreUp) return;
        const scoreKey = `${next.id}:${next.home_score ?? 0}-${next.away_score ?? 0}`;
        if (celebratedScores.has(scoreKey) || pendingFallbacks.has(scoreKey)) return;
        // Give the rich match_events row a moment to arrive with the scorer;
        // fall back to a plain celebration if it doesn't.
        pendingFallbacks.set(
          scoreKey,
          setTimeout(() => {
            pendingFallbacks.delete(scoreKey);
            if (celebratedScores.has(scoreKey)) return;
            celebratedScores.add(scoreKey);
            onGoalRef.current?.({ matchId: next.id, match: next });
          }, GOAL_EVENT_GRACE_MS),
        );
      } else if (next.status === 'finished' && (!prev || prev.status !== 'finished')) {
        // Late score backfills re-update finished rows — only celebrate the
        // actual transition, and only with a real score.
        if (next.home_score != null && next.away_score != null) {
          onResultRef.current?.({ matchId: next.id, match: next });
        }
      }
    };

    const onEventInsert = (payload: { new: unknown }) => {
      const ev = payload.new as MatchEventRow;

      // Keep the shared events cache (goals + cards) fresh for match cards
      // (the photo joins in on the next refetch; initials show until then).
      qc.setQueryData<GoalEvent[]>(matchEventsKey, (old) =>
        old && !old.some((e) => e.id === ev.id)
          ? [...old, { ...ev, player_photo: null }]
          : old,
      );

      if (ev.type !== 'goal') return; // celebrations are goal-only
      const match = findMatch(ev.match_id);
      if (!match) return;
      const scoreKey = `${ev.match_id}:${ev.score_home ?? 0}-${ev.score_away ?? 0}`;
      const pending = pendingFallbacks.get(scoreKey);
      if (pending) {
        clearTimeout(pending);
        pendingFallbacks.delete(scoreKey);
      }
      if (celebratedScores.has(scoreKey)) return;
      // Old events arrive on (re)sync backfills too — only celebrate fresh
      // ones (inserted within the last couple of minutes).
      if (Date.now() - new Date(ev.created_at).getTime() > 2 * 60_000) return;
      celebratedScores.add(scoreKey);
      onGoalRef.current?.({
        matchId: ev.match_id,
        match,
        goal: {
          playerName: ev.player_name,
          minute: ev.minute,
          teamId: ev.team_id,
          scoreHome: ev.score_home,
          scoreAway: ev.score_away,
        },
      });
    };

    // sync-scores reconciles match_events against the live feed: a VAR-annulled
    // goal is DELETEd and a corrected one UPDATEd. Reflect both so the scorer
    // disappears / updates in place instead of lingering until a refetch.
    const onEventUpdate = (payload: { new: unknown }) => {
      const ev = payload.new as MatchEventRow;
      qc.setQueryData<GoalEvent[]>(matchEventsKey, (old) =>
        (old ?? []).map((e) => (e.id === ev.id ? { ...e, ...ev } : e)),
      );
    };

    const onEventDelete = (payload: { old: unknown }) => {
      const oldId = (payload.old as { id?: string })?.id;
      if (!oldId) return;
      qc.setQueryData<GoalEvent[]>(matchEventsKey, (old) =>
        (old ?? []).filter((e) => e.id !== oldId),
      );
    };

    const teardown = () => {
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };

    const subscribe = () => {
      if (disposed) return;
      teardown();
      channel = supabase
        .channel('live-matches')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'matches' },
          onMatchUpdate,
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'match_events' },
          onEventInsert,
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'match_events' },
          onEventUpdate,
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'match_events' },
          onEventDelete,
        )
        .subscribe((status) => {
          if (disposed) return;
          if (status === 'SUBSCRIBED') {
            retryDelay = 2000;
            // On a *re*-connect (after a drop), refetch what the socket missed
            // while it was down. Skip the very first connect (initial fetch
            // already runs).
            if (hasConnected) {
              qc.invalidateQueries({ queryKey: matchesKey });
              qc.invalidateQueries({ queryKey: matchEventsKey });
            }
            hasConnected = true;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            // A dead channel never revives itself — rebuild it with backoff.
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(subscribe, retryDelay);
            retryDelay = Math.min(retryDelay * 2, 30_000);
          }
        });
    };

    subscribe();

    // Foreground → resubscribe and refetch what the socket missed while iOS
    // had the app suspended.
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || disposed) return;
      subscribe();
      qc.invalidateQueries({ queryKey: matchesKey });
      qc.invalidateQueries({ queryKey: matchEventsKey });
    });

    return () => {
      disposed = true;
      appState.remove();
      if (retryTimer) clearTimeout(retryTimer);
      pendingFallbacks.forEach((t) => clearTimeout(t));
      teardown();
    };
  }, [qc]);
}

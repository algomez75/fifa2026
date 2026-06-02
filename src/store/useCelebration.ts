import { create } from 'zustand';

export type CelebrationKind = 'goal' | 'result' | 'challenge';

export interface Celebration {
  kind: CelebrationKind;
  title: string;
  label?: string;
  /** Optional dedupe key so the same event (e.g. a result arriving via both
   *  Realtime and a push) doesn't replay the overlay twice. */
  key?: string;
}

interface CelebrationState {
  current: Celebration | null;
  _lastKey: string | null;
  _lastAt: number;
  celebrate: (c: Celebration) => void;
  clear: () => void;
}

/**
 * App-wide animation bus. Any source — live Realtime score/result, a foreground
 * push, or an in-app event — can `celebrate()` and a single root overlay plays
 * the matching Lottie. Repeats of the same `key` within a short window, or a
 * celebration fired while one is already showing, are dropped.
 */
export const useCelebration = create<CelebrationState>((set, get) => ({
  current: null,
  _lastKey: null,
  _lastAt: 0,
  celebrate: (c) => {
    const now = Date.now();
    const { current, _lastKey, _lastAt } = get();
    if (current) return; // don't stack overlays
    if (c.key && c.key === _lastKey && now - _lastAt < 12000) return;
    set({ current: c, _lastKey: c.key ?? null, _lastAt: now });
  },
  clear: () => set({ current: null }),
}));

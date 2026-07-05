import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus } from 'react-native';

import { isSupabaseConfigured, supabase } from './supabase';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 60,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

// --- Always-fresh on reopen --------------------------------------------------
// iOS suspends timers and sockets while the app is backgrounded, so on resume:
//   1. make sure the Supabase access token is valid FIRST — with an expired JWT
//      every refetch 401s, TanStack keeps the cached (stale) data, and the UI
//      looks frozen in the past until a later poll succeeds;
//   2. then mark the app focused (resumes paused refetchIntervals + focus
//      refetch) and invalidate the ENTIRE query cache: every mounted screen
//      refetches immediately, and any screen opened afterwards is stale so it
//      refetches on mount. Net effect: whatever page you're on or open next
//      shows live data the moment the app comes back.
// A sub-2s dip through 'inactive' (notification shade, control centre, Face ID
// prompt) isn't a real background — skip the full invalidate for those unless
// the app actually reached 'background'.

const FULL_REFRESH_MIN_AWAY_MS = 2000;
const SESSION_WAIT_CAP_MS = 1500;

let awaySince = 0;
let wasBackgrounded = false;

/** Refresh an expired session before refetching; never block for long. */
async function ensureFreshSession(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await Promise.race([
      // getSession() proactively refreshes the token when it's expired.
      supabase.auth.getSession(),
      new Promise((resolve) => setTimeout(resolve, SESSION_WAIT_CAP_MS)),
    ]);
  } catch {
    // Offline — refetches will fail and keep cached data; polls retry later.
  }
}

AppState.addEventListener('change', (state: AppStateStatus) => {
  if (state !== 'active') {
    focusManager.setFocused(false);
    if (!awaySince) awaySince = Date.now();
    if (state === 'background') wasBackgrounded = true;
    return;
  }
  const awayMs = awaySince ? Date.now() - awaySince : 0;
  const fullRefresh = wasBackgrounded || awayMs >= FULL_REFRESH_MIN_AWAY_MS;
  awaySince = 0;
  wasBackgrounded = false;
  void ensureFreshSession().finally(() => {
    focusManager.setFocused(true);
    if (fullRefresh) void queryClient.invalidateQueries();
  });
});

import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Silently keeps the app up to date over EAS Update / expo-updates.
 *
 * The new bundle is downloaded **in the background** and is left for
 * expo-updates to apply on the next cold start — we deliberately never call
 * `reloadAsync()`, so the user never sees an "updating" splash / blue reload
 * screen mid-session. "If it's going to update, do it hidden."
 *
 * No-op in dev / Expo Go (`Updates.isEnabled` is false there): the blue reload
 * flash you see while testing is Metro fast-refresh, not an OTA update, and
 * won't happen in a store build.
 */
export function useSilentUpdate() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;

    let cancelled = false;

    async function downloadIfAvailable() {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (cancelled || !check.isAvailable) return;
        // Fetch only — do NOT reload. The downloaded update auto-applies on
        // the next cold launch, so the swap is invisible to the user.
        await Updates.fetchUpdateAsync();
      } catch {
        // Offline or no update server reachable — keep running the cached
        // bundle silently; we'll retry on the next foreground.
      }
    }

    void downloadIfAvailable();

    // Catch updates published while the app is open/backgrounded so they're
    // ready for the user's next cold start.
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void downloadIfAvailable();
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}

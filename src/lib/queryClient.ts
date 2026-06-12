import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

// Wire TanStack's focus tracking to the app lifecycle so queries marked
// `refetchOnWindowFocus` re-fetch when the app returns to the foreground —
// iOS suspends sockets/timers in the background, so this is what keeps tab
// screens (which never remount) from going stale after a suspend.
AppState.addEventListener('change', (state) => {
  focusManager.setFocused(state === 'active');
});

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

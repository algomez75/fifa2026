import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useEffect } from 'react';

import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { useLiveEvents } from '@/hooks/useLiveEvents';
import { useNotifications } from '@/hooks/useNotifications';
import { queryClient } from '@/lib/queryClient';
import { initAuth } from '@/store/useAuthStore';
import { palette } from '@/lib/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  // Bootstrap auth: restore session or sign in anonymously; keep store in sync.
  useEffect(() => {
    void initAuth();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: palette.bg },
              animation: 'slide_from_right',
            }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="team/[id]"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="user/[id]"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="profile"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="legal/privacy"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="legal/terms"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="notifications"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="challenges"
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />
          </Stack>
          {/* Push registration, live-event → animation bridge, and the root
              celebration overlay. Inside the provider so they can use the query
              cache. */}
          <GlobalServices />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Lives inside QueryClientProvider so its hooks can touch the query cache. */
function GlobalServices() {
  useNotifications(); // register for push + wire notification listeners
  useLiveEvents(); // live score/result Realtime → celebration overlay
  return <CelebrationOverlay />;
}

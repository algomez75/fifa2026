import { QueryClientProvider } from '@tanstack/react-query';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useEffect } from 'react';

import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { useLiveEvents } from '@/hooks/useLiveEvents';
import { useNotifications } from '@/hooks/useNotifications';
import { useSilentUpdate } from '@/hooks/useSilentUpdate';
import { prefetchLeaderboard } from '@/hooks/useLeaderboard';
import { queryClient } from '@/lib/queryClient';
import { initAuth } from '@/store/useAuthStore';
import { palette } from '@/lib/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * Root error boundary. In a production build an uncaught render error would
 * otherwise show a blank white screen with no info; this surfaces the message
 * + stack on-device (selectable, so it can be copied) and offers a retry.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0A0E1A' }}
      contentContainerStyle={{ padding: 24, paddingTop: 80 }}>
      <Text style={{ color: '#D4AF37', fontSize: 22, fontWeight: '800', marginBottom: 12 }}>
        Something broke at startup
      </Text>
      <Text selectable style={{ color: '#fff', fontSize: 14, marginBottom: 12 }}>
        {error?.message ?? 'Unknown error'}
      </Text>
      <Text selectable style={{ color: '#8A93A6', fontSize: 11 }}>
        {error?.stack ?? ''}
      </Text>
      <Pressable
        onPress={retry}
        style={{ marginTop: 24, alignSelf: 'flex-start', backgroundColor: '#D4AF37', paddingVertical: 12, paddingHorizontal: 22, borderRadius: 12 }}>
        <Text style={{ color: '#0A0E1A', fontWeight: '800' }}>Retry</Text>
      </Pressable>
    </ScrollView>
  );
}

export default function RootLayout() {
  // Bootstrap auth: restore session or sign in anonymously; keep store in sync.
  // Then warm the ranking cache so the Leaderboard tab opens instantly.
  useEffect(() => {
    void initAuth().finally(() => {
      void prefetchLeaderboard();
    });
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
              name="match/[id]"
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
  useSilentUpdate(); // download OTA updates in the background, apply next launch (no visible reload)
  return <CelebrationOverlay />;
}

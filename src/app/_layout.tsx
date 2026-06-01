import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAnonAuth } from '@/hooks/useAnonAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { queryClient } from '@/lib/queryClient';
import { palette } from '@/lib/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  // Establish an anonymous session so favorites/push persist to user_settings.
  useAnonAuth();
  // Register for push notifications (no-op until permissions/credentials exist).
  useNotifications();

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
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

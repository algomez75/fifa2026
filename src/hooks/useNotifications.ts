import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulators can't get a token

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'WC26 alerts',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#D4AF37',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) return null; // needs an EAS project to mint a token

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

/**
 * Registers the device for push and stores the Expo token in `user_settings`
 * when Supabase is configured & the user is signed in. Fails silently in Expo
 * Go / simulators / web — the app keeps working without push.
 */
export function useNotifications() {
  const registered = useRef(false);

  useEffect(() => {
    if (registered.current) return;
    registered.current = true;

    (async () => {
      try {
        const token = await registerForPush();
        if (!token || !isSupabaseConfigured) return;
        const { data } = await supabase.auth.getUser();
        const userId = data.user?.id;
        if (!userId) return;
        await supabase
          .from('user_settings')
          .upsert({ user_id: userId, expo_push_token: token });
      } catch {
        // best-effort: push is optional
      }
    })();
  }, []);
}

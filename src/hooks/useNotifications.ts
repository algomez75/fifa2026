import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { type Href, router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { queryClient } from '@/lib/queryClient';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useCelebration } from '@/store/useCelebration';
import { inboxKey } from './useInbox';

// Show alerts (banner + sound) even while the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Asks for notification permission (the startup policy) and returns an Expo
 *  push token when granted on a real device with EAS credentials. */
async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulators can't get a token

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '11 Gol alerts',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#D4AF37',
    });
  }

  // Prompt at startup if we don't already have a decision.
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null; // needs an EAS project to mint a token

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

type NotifData = {
  type?: 'kickoff' | 'result' | 'goal' | 'lineup' | 'challenge' | 'predict' | 'leaderboard';
  matchId?: string;
  eventId?: string;
  challengeId?: string;
};

/**
 * Registers the device for push (prompting for permission at startup), stores
 * the Expo token in `user_settings`, and wires the two notification listeners:
 *
 *  - **received (foreground):** refresh the inbox badge and play a celebration
 *    for live results, so on-device alerts feed the in-app animation system.
 *  - **response (tap):** deep-link to the relevant screen.
 *
 * Fails silently in Expo Go / simulators / web — the app keeps working.
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

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener((n) => {
      // A device alert arrived while the app is open → keep the badge live and
      // feed the animation system.
      queryClient.invalidateQueries({ queryKey: inboxKey });
      const data = (n.request.content.data ?? {}) as NotifData;
      if (data.type === 'result' && n.request.content.body) {
        useCelebration.getState().celebrate({
          kind: 'result',
          title: n.request.content.title ?? '🏁',
          label: n.request.content.body,
          key: data.matchId ? `result:${data.matchId}` : undefined,
        });
      } else if (data.type === 'goal' && n.request.content.body) {
        // Goal push while the app is open → same celebration the Realtime
        // event triggers; the store's key dedupe keeps it from playing twice.
        useCelebration.getState().celebrate({
          kind: 'goal',
          title: n.request.content.title ?? '⚽',
          label: n.request.content.body,
          key: data.eventId ? `goal-ev:${data.eventId}` : undefined,
        });
      }
    });

    const response = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = (r.notification.request.content.data ?? {}) as NotifData;
      queryClient.invalidateQueries({ queryKey: inboxKey });
      // Tapping a challenge opens the inbox; a leaderboard nudge opens the
      // ranking; any match alert (lineup / kickoff / goal / full time / predict
      // reminder) opens that match's detail screen — so a "predict" tap lands on
      // the match with its Make-a-prediction CTA.
      if (data.type === 'challenge') {
        router.push('/notifications');
      } else if (data.type === 'leaderboard') {
        router.push('/leaderboard' as Href);
      } else if (data.matchId) {
        router.push(`/match/${data.matchId}` as Href);
      }
    });

    return () => {
      received.remove();
      response.remove();
    };
  }, []);
}

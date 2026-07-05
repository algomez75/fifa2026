import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * `true` once real Supabase credentials are wired into `.env`. Until then the
 * app runs fully on bundled seed data and skips network calls — every hook
 * checks this flag so the UI never hangs on a missing backend.
 */
export const isSupabaseConfigured =
  supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'public-anon-placeholder',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    realtime: { params: { eventsPerSecond: 8 } },
  },
);

// Supabase's session auto-refresh runs on a JS timer that iOS/Android freeze
// while the app is backgrounded, so a long suspend leaves an EXPIRED access
// token — every PostgREST call then 401s until the next lazy refresh, which
// reads as "the app shows old data for a while after reopening". Per the
// official React Native guidance, tie the refresher to the app lifecycle:
// startAutoRefresh() also runs an immediate tick, renewing an expired token
// the moment the app returns to the foreground.
if (isSupabaseConfigured) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}

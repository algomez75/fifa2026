import { useEffect } from 'react';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Ensures a Supabase session exists (anonymous) so RLS-protected writes to
 * `user_settings` (favorites, push token) succeed. No-op offline / unconfigured.
 * The local Zustand store remains the source of truth; this just enables a
 * cloud mirror keyed to a stable anonymous user id.
 */
export function useAnonAuth() {
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          await supabase.auth.signInAnonymously();
        }
      } catch {
        // best-effort — favorites still work locally
      }
    })();
  }, []);
}

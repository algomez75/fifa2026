import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useProfileStore } from './useProfileStore';

interface AuthState {
  session: Session | null;
  user: User | null;
  /** true once the initial session check has completed. */
  ready: boolean;
  setSession: (session: Session | null) => void;
  setReady: (ready: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  ready: false,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setReady: (ready) => set({ ready }),
}));

/** Is the current user anonymous (not yet a real account)? */
export function selectIsAnonymous(s: AuthState): boolean {
  return !!s.user?.is_anonymous || (!!s.user && !s.user.email);
}

let initialized = false;

/**
 * One-time auth bootstrap: restore session, keep the store in sync via
 * onAuthStateChange, and sign in anonymously if there's no session yet.
 */
export async function initAuth() {
  if (initialized || !isSupabaseConfigured) {
    useAuthStore.getState().setReady(true);
    return;
  }
  initialized = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.getState().setSession(session);
    void useProfileStore.getState().loadProfile();
  });

  const { data } = await supabase.auth.getSession();
  if (data.session) {
    useAuthStore.getState().setSession(data.session);
  } else {
    const { data: anon } = await supabase.auth.signInAnonymously();
    useAuthStore.getState().setSession(anon.session ?? null);
  }
  await useProfileStore.getState().loadProfile();
  useAuthStore.getState().setReady(true);
}

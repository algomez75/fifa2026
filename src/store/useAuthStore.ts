import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useAppStore } from './useAppStore';
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

/** Is the current user a guest (not a real, email/Apple account)? */
export function selectIsAnonymous(s: AuthState): boolean {
  // No user yet — bootstrap still running, or anonymous sign-in failed/disabled
  // on the project — counts as a guest so the account screen offers sign-up /
  // Sign in with Apple instead of stranding the user on the logged-in member UI.
  if (!s.user) return true;
  return !!s.user.is_anonymous || !s.user.email;
}

let initialized = false;
/** The user id whose favorites are currently loaded into the local store. Lets
 *  us reload favorites only when the active user actually changes (login /
 *  logout / account switch) and skip no-op events like token refreshes. */
let favoritesUserId: string | null | undefined = undefined;

/**
 * Load the given user's favorite teams from `user_settings` into the local
 * store so each account (guest or member) sees only its own favorites. On sign
 * out (no user) we reset to empty; if the remote read fails (offline) we keep
 * the existing local cache rather than wiping it.
 */
async function loadFavoritesForUser(userId: string | null) {
  favoritesUserId = userId;
  if (!isSupabaseConfigured) return;
  if (!userId) {
    useAppStore.getState().setFavorites([]);
    return;
  }
  const { data, error } = await supabase
    .from('user_settings')
    .select('favorite_team_ids')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return; // offline / failed — keep the local cache, don't clobber
  useAppStore.getState().setFavorites(data?.favorite_team_ids ?? []);
}

/** Reload favorites only when the active user id changed. */
function syncFavoritesOnAuthChange(userId: string | null) {
  if (userId === favoritesUserId) return;
  void loadFavoritesForUser(userId);
}

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
    syncFavoritesOnAuthChange(session?.user?.id ?? null);
    void useProfileStore.getState().loadProfile();
  });

  const { data } = await supabase.auth.getSession();
  if (data.session) {
    useAuthStore.getState().setSession(data.session);
  } else {
    const { data: anon } = await supabase.auth.signInAnonymously();
    useAuthStore.getState().setSession(anon.session ?? null);
  }
  syncFavoritesOnAuthChange(useAuthStore.getState().user?.id ?? null);
  await useProfileStore.getState().loadProfile();
  useAuthStore.getState().setReady(true);
}

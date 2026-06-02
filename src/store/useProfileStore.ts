import { create } from 'zustand';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

interface ProfileState {
  displayName: string | null;
  avatarUrl: string | null;
  loaded: boolean;
  loadProfile: () => Promise<void>;
  setProfile: (p: { displayName?: string | null; avatarUrl?: string | null }) => void;
  clear: () => void;
}

/** Current user's public profile (display name + avatar), kept app-wide so the
 *  header avatar updates everywhere after an edit. */
export const useProfileStore = create<ProfileState>((set) => ({
  displayName: null,
  avatarUrl: null,
  loaded: false,
  loadProfile: async () => {
    if (!isSupabaseConfigured) return set({ loaded: true });
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return set({ displayName: null, avatarUrl: null, loaded: true });
    const { data: prof } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('user_id', userId)
      .maybeSingle();
    set({
      displayName: prof?.display_name ?? null,
      avatarUrl: prof?.avatar_url ?? null,
      loaded: true,
    });
  },
  setProfile: ({ displayName, avatarUrl }) =>
    set((s) => ({
      displayName: displayName !== undefined ? displayName : s.displayName,
      avatarUrl: avatarUrl !== undefined ? avatarUrl : s.avatarUrl,
    })),
  clear: () => set({ displayName: null, avatarUrl: null }),
}));

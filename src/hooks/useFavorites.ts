import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { MAX_FAVORITES, useAppStore } from '@/store/useAppStore';

/**
 * Favorite teams CRUD. Local Zustand store is the source of truth (works
 * offline); when Supabase is configured and a user is signed in, changes are
 * mirrored to `user_settings.favorite_team_ids`.
 */
export function useFavorites() {
  const favorites = useAppStore((s) => s.favoriteTeamIds);
  const toggle = useAppStore((s) => s.toggleFavorite);

  const syncRemote = useCallback(async (ids: string[]) => {
    if (!isSupabaseConfigured) return;
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return; // anonymous — local only
    await supabase
      .from('user_settings')
      .upsert({ user_id: userId, favorite_team_ids: ids });
  }, []);

  const toggleFavorite = useCallback(
    async (teamId: string) => {
      const wasFavorite = useAppStore.getState().isFavorite(teamId);
      const atLimit =
        !wasFavorite &&
        useAppStore.getState().favoriteTeamIds.length >= MAX_FAVORITES;

      if (atLimit) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return { changed: false, atLimit: true };
      }

      toggle(teamId);
      Haptics.impactAsync(
        wasFavorite
          ? Haptics.ImpactFeedbackStyle.Light
          : Haptics.ImpactFeedbackStyle.Medium,
      );
      void syncRemote(useAppStore.getState().favoriteTeamIds);
      return { changed: true, atLimit: false };
    },
    [toggle, syncRemote],
  );

  return {
    favorites,
    isFavorite: (id: string) => favorites.includes(id),
    toggleFavorite,
    isFull: favorites.length >= MAX_FAVORITES,
  };
}

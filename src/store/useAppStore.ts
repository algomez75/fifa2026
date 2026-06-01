import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { deviceLanguage, getDictionary, type Language } from '@/lib/i18n';
import type { Stage } from '@/lib/database.types';

export const MAX_FAVORITES = 5;

export type HostFilter = 'all' | 'USA' | 'Mexico' | 'Canada';
export type GroupsView = 'groups' | 'bracket';

interface AppState {
  language: Language;
  /** Local favorites cache — source of truth until Supabase auth is connected. */
  favoriteTeamIds: string[];
  onlyMyTeams: boolean;
  // Schedule filters
  filterStage: Stage | 'all';
  filterGroup: string | 'all';
  filterHost: HostFilter;
  groupsView: GroupsView;

  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  toggleFavorite: (teamId: string) => boolean; // returns true if now favorited
  isFavorite: (teamId: string) => boolean;
  setOnlyMyTeams: (v: boolean) => void;
  setFilterStage: (s: Stage | 'all') => void;
  setFilterGroup: (g: string | 'all') => void;
  setFilterHost: (h: HostFilter) => void;
  setGroupsView: (v: GroupsView) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      language: deviceLanguage(),
      favoriteTeamIds: [],
      onlyMyTeams: false,
      filterStage: 'all',
      filterGroup: 'all',
      filterHost: 'all',
      groupsView: 'groups',

      setLanguage: (language) => set({ language }),
      toggleLanguage: () =>
        set((s) => ({ language: s.language === 'en' ? 'es' : 'en' })),

      toggleFavorite: (teamId) => {
        const current = get().favoriteTeamIds;
        const has = current.includes(teamId);
        if (has) {
          set({ favoriteTeamIds: current.filter((id) => id !== teamId) });
          return false;
        }
        if (current.length >= MAX_FAVORITES) return false;
        set({ favoriteTeamIds: [...current, teamId] });
        return true;
      },
      isFavorite: (teamId) => get().favoriteTeamIds.includes(teamId),
      setOnlyMyTeams: (onlyMyTeams) => set({ onlyMyTeams }),
      setFilterStage: (filterStage) => set({ filterStage }),
      setFilterGroup: (filterGroup) => set({ filterGroup }),
      setFilterHost: (filterHost) => set({ filterHost }),
      setGroupsView: (groupsView) => set({ groupsView }),
    }),
    {
      name: 'wc26-app-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        language: s.language,
        favoriteTeamIds: s.favoriteTeamIds,
        onlyMyTeams: s.onlyMyTeams,
      }),
    },
  ),
);

/** Convenience hook: returns the active dictionary for the current language. */
export function useTranslation() {
  const language = useAppStore((s) => s.language);
  return { t: getDictionary(language), language };
}

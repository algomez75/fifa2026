import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { NotificationRow } from '@/lib/database.types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

export const inboxKey = ['inbox'] as const;

async function fetchInbox(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    // RLS already scopes this to the caller; the explicit filter is
    // defense-in-depth so a future RLS regression can't leak others' rows.
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

/** Notifications inbox + unread count. Polls so the ball badge stays live.
 *  This hook is mounted in the header of EVERY screen, so the user id is read
 *  from the auth store (local) instead of calling `supabase.auth.getUser()`
 *  (a network round-trip) on every 20s tick. Keyed by user id so an account
 *  switch swaps cleanly; the `['inbox']` prefix still matches all invalidations. */
export function useInbox() {
  const userId = useAuthStore((s) => s.user?.id) ?? null;
  const query = useQuery({
    queryKey: [...inboxKey, userId],
    queryFn: () => fetchInbox(userId!),
    enabled: isSupabaseConfigured && !!userId,
    staleTime: 1000 * 10,
    refetchInterval: 20000,
    refetchIntervalInBackground: false,
  });
  const unread = (query.data ?? []).filter((n) => !n.read).length;
  return { ...query, unread };
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id?: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      let q = supabase.from('notifications').update({ read: true }).eq('user_id', u.user.id);
      if (id) q = q.eq('id', id);
      else q = q.eq('read', false);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: inboxKey }),
  });
}

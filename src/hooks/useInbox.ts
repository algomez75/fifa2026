import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { NotificationRow } from '@/lib/database.types';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const inboxKey = ['inbox'] as const;

async function fetchInbox(): Promise<NotificationRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    // RLS already scopes this to the caller; the explicit filter is
    // defense-in-depth so a future RLS regression can't leak others' rows.
    .eq('user_id', u.user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

/** Notifications inbox + unread count. Polls so the ball badge stays live. */
export function useInbox() {
  const query = useQuery({
    queryKey: inboxKey,
    queryFn: fetchInbox,
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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { NotificationRow } from '@/lib/types';

export function useNotifications(foreningId: string | null) {
  return useQuery<NotificationRow[]>({
    queryKey: ['notifications', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification')
        .select('*')
        .eq('forening_id', foreningId as string)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data as NotificationRow[]) ?? [];
    },
  });
}

/** Mark all of a förening's notifications as read for the current user. */
export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (foreningId) => {
      const { error } = await supabase
        .from('notification')
        .update({ read: true })
        .eq('forening_id', foreningId)
        .eq('read', false);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, foreningId) => {
      qc.invalidateQueries({ queryKey: ['notifications', foreningId] });
      qc.invalidateQueries({ queryKey: ['home'] });
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  Checkin, Membership, MissionWithProgress, NotificationRow,
} from '@/lib/types';

export type HomeData = {
  membership: Membership | null;
  unreadCount: number;
  missions: MissionWithProgress[];
  recent: Checkin[];
};

/**
 * Reads the youth home dashboard for one förening. All queries are scoped by
 * forening_id; RLS additionally guarantees the caller only ever sees their own
 * tenant's rows.
 */
export function useHomeData(foreningId: string | null, userId: string | undefined) {
  return useQuery<HomeData>({
    queryKey: ['home', foreningId, userId],
    enabled: !!foreningId && !!userId,
    queryFn: async () => {
      const fid = foreningId as string;

      const [membershipRes, unreadRes, missionsRes, recentRes] = await Promise.all([
        supabase
          .from('membership')
          .select('*')
          .eq('forening_id', fid)
          .eq('user_id', userId as string)
          .maybeSingle(),
        supabase
          .from('notification')
          .select('id', { count: 'exact', head: true })
          .eq('forening_id', fid)
          .eq('read', false),
        supabase
          .from('mission')
          .select('*, mission_progress(progress, done)')
          .eq('forening_id', fid)
          .eq('active', true)
          .order('sort', { ascending: true })
          .limit(2),
        supabase
          .from('checkin')
          .select('id, title, awarded_points, created_at')
          .eq('forening_id', fid)
          .order('created_at', { ascending: false })
          .limit(3),
      ]);

      return {
        membership: (membershipRes.data as Membership) ?? null,
        unreadCount: unreadRes.count ?? 0,
        missions: (missionsRes.data as MissionWithProgress[]) ?? [],
        recent: (recentRes.data as Checkin[]) ?? [],
      };
    },
  });
}

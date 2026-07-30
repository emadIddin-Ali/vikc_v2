import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Checkin, HomeActivity, Membership, MissionWithProgress } from '@/lib/types';

export type HomeData = {
  membership: Membership | null;
  unreadCount: number;
  missions: MissionWithProgress[];
  recent: Checkin[];
  activities: HomeActivity[];
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

      const [membershipRes, unreadRes, missionsRes, recentRes, activitiesRes] = await Promise.all([
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
        // "Senaste besök" and the card's checked-in-today check are about *you*.
        // RLS lets a ledare read the whole förening's check-ins, so filter here.
        supabase
          .from('checkin')
          .select('id, title, awarded_points, created_at')
          .eq('forening_id', fid)
          .eq('user_id', userId as string)
          .eq('pending', false)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase
          .from('activity')
          .select('id, title, when_text, points, starts_at, duration_min, continuous, theme')
          .eq('forening_id', fid)
          .eq('active', true)
          .order('starts_at', { ascending: true, nullsFirst: false })
          .limit(8),
      ]);

      // Show what's still checkable: continuous always; a dated activity only
      // until its window ends (start + duration, or the end of its day when no
      // duration is set) — otherwise old activities linger forever. Undated
      // non-continuous rows (legacy) are kept, they have no time to expire on.
      const now = Date.now();
      const activities = ((activitiesRes.data as HomeActivity[]) ?? [])
        .filter((a) => {
          if (a.continuous || !a.starts_at) return true;
          const start = new Date(a.starts_at).getTime();
          const end = a.duration_min != null
            ? start + a.duration_min * 60_000
            : new Date(a.starts_at).setHours(23, 59, 59, 999);
          return now <= end;
        })
        .slice(0, 3);

      return {
        membership: (membershipRes.data as Membership) ?? null,
        unreadCount: unreadRes.count ?? 0,
        missions: (missionsRes.data as MissionWithProgress[]) ?? [],
        recent: (recentRes.data as Checkin[]) ?? [],
        activities,
      };
    },
  });
}

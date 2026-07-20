import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { BadgeRow, Checkin } from '@/lib/types';

export type ProfileStats = { points: number; visits: number; streak: number; level: number };

/** Stats + badges + this-month check-in count for the youth profile. */
export function useProfileData(foreningId: string | null, userId: string | undefined) {
  return useQuery<{ stats: ProfileStats; badges: BadgeRow[]; monthCount: number }>({
    queryKey: ['profile', foreningId, userId],
    enabled: !!foreningId && !!userId,
    queryFn: async () => {
      const fid = foreningId as string;
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [memRes, badgesRes, monthRes] = await Promise.all([
        supabase.from('membership').select('points, visits, streak, level').eq('forening_id', fid).eq('user_id', userId as string).maybeSingle(),
        supabase.rpc('youth_badges', { p_forening: fid }),
        supabase.from('checkin').select('id', { count: 'exact', head: true }).eq('forening_id', fid).eq('user_id', userId as string).gte('created_at', startOfMonth.toISOString()),
      ]);

      return {
        stats: (memRes.data as ProfileStats) ?? { points: 0, visits: 0, streak: 0, level: 1 },
        badges: (badgesRes.data as BadgeRow[]) ?? [],
        monthCount: monthRes.count ?? 0,
      };
    },
  });
}

/** The member's own check-in history for the förening. */
export function useAttendanceList(foreningId: string | null, userId: string | undefined) {
  return useQuery<Checkin[]>({
    queryKey: ['attendance', foreningId, userId],
    enabled: !!foreningId && !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from('checkin')
        .select('id, title, awarded_points, created_at')
        .eq('forening_id', foreningId as string)
        .eq('user_id', userId as string)
        .order('created_at', { ascending: false })
        .limit(50);
      return (data as Checkin[]) ?? [];
    },
  });
}

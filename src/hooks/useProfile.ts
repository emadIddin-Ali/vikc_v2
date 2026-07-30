import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { BadgeRow, Checkin } from '@/lib/types';

export type ProfileStats = { points: number; visits: number; week_streak: number; level: number };

/** Stats + badges + this-month check-in count for the youth profile. */
export function useProfileData(foreningId: string | null, userId: string | undefined) {
  return useQuery<{ stats: ProfileStats; badges: BadgeRow[]; monthCount: number }>({
    queryKey: ['profile', foreningId, userId],
    enabled: !!foreningId && !!userId,
    queryFn: async () => {
      const fid = foreningId as string;
      const uid = userId as string;
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [memRes, badgesRes, monthRes] = await Promise.all([
        supabase.from('membership').select('points, visits, week_streak, level').eq('forening_id', fid).eq('user_id', uid).maybeSingle(),
        supabase.rpc('youth_badges', { p_forening: fid }),
        // user_id filter is explicit, not left to RLS: a ledare viewing their own
        // profile can select the whole förening's check-ins.
        supabase.from('checkin').select('id', { count: 'exact', head: true }).eq('forening_id', fid).eq('user_id', uid).eq('pending', false).gte('created_at', startOfMonth.toISOString()),
      ]);

      return {
        stats: (memRes.data as ProfileStats) ?? { points: 0, visits: 0, week_streak: 0, level: 1 },
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
        .eq('pending', false)
        .order('created_at', { ascending: false })
        .limit(50);
      return (data as Checkin[]) ?? [];
    },
  });
}

/** Badges grouped by catalog category, in catalog order. */
export function groupBadges(badges: BadgeRow[]): { category: string; items: BadgeRow[] }[] {
  const groups: { category: string; items: BadgeRow[] }[] = [];
  for (const b of badges) {
    const last = groups[groups.length - 1];
    if (last && last.category === b.category) last.items.push(b);
    else groups.push({ category: b.category, items: [b] });
  }
  return groups;
}

/**
 * The `count` badges worth putting on the profile: everything unlocked first,
 * then the locked ones the member is closest to earning — so the strip always
 * shows both a reward and a next goal.
 */
export function highlightBadges(badges: BadgeRow[], count = 8): BadgeRow[] {
  const unlocked = badges.filter((b) => b.unlocked);
  const next = badges
    .filter((b) => !b.unlocked && !b.secret)
    .sort((a, b) => b.progress / b.goal - a.progress / a.goal);
  return [...unlocked, ...next].slice(0, count);
}

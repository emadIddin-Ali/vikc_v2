import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { ForraToppRad, LeaderboardEntry, MinVecka, SasongStatus } from '@/lib/types';

export type LeaderboardData = {
  entries: LeaderboardEntry[];
  sasong: SasongStatus | null;
  forra: ForraToppRad[];
};

/**
 * The season leaderboard. Ranks on XP earned since the season started, not on
 * the points balance — otherwise spending in the shop costs you your place,
 * which with a market every other month made the list measure who had not yet
 * got round to shopping.
 */
export function useLeaderboard(foreningId: string | null) {
  return useQuery<LeaderboardData>({
    queryKey: ['leaderboard', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const fid = foreningId as string;
      const [listRes, sasongRes, forraRes] = await Promise.all([
        supabase.rpc('leaderboard', { p_forening: fid }),
        supabase.rpc('sasong_status', { p_forening: fid }),
        supabase.rpc('leaderboard_forra', { p_forening: fid }),
      ]);
      if (listRes.error) throw new Error(listRes.error.message);
      return {
        entries: (listRes.data as LeaderboardEntry[]) ?? [],
        sasong: (sasongRes.data as SasongStatus) ?? null,
        forra: (forraRes.data as ForraToppRad[]) ?? [],
      };
    },
  });
}

/** The home screen's week card: XP this week, weekly goal, streak, season total. */
export function useMinVecka(foreningId: string | null, childId: string | null = null) {
  return useQuery<MinVecka | null>({
    queryKey: ['min-vecka', foreningId, childId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('min_vecka', {
        p_forening: foreningId,
        p_child: childId,
      });
      if (error) throw new Error(error.message);
      return (data as MinVecka) ?? null;
    },
  });
}

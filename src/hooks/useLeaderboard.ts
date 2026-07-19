import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { LeaderboardEntry } from '@/lib/types';

export function useLeaderboard(foreningId: string | null) {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('leaderboard', { p_forening: foreningId });
      if (error) throw new Error(error.message);
      return (data as LeaderboardEntry[]) ?? [];
    },
  });
}

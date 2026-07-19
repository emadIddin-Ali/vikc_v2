import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { MissionWithProgress } from '@/lib/types';
import { toast } from '@/store/toast';

export type MissionsData = {
  missions: MissionWithProgress[];
  points: number;
  streak: number;
};

export function useMissions(foreningId: string | null, userId: string | undefined) {
  return useQuery<MissionsData>({
    queryKey: ['missions', foreningId, userId],
    enabled: !!foreningId && !!userId,
    queryFn: async () => {
      const fid = foreningId as string;
      const [missionsRes, memRes] = await Promise.all([
        supabase
          .from('mission')
          .select('*, mission_progress(progress, done)')
          .eq('forening_id', fid)
          .eq('active', true)
          .order('sort', { ascending: true }),
        supabase
          .from('membership')
          .select('points, streak')
          .eq('forening_id', fid)
          .eq('user_id', userId as string)
          .maybeSingle(),
      ]);
      return {
        missions: (missionsRes.data as MissionWithProgress[]) ?? [],
        points: (memRes.data as { points: number } | null)?.points ?? 0,
        streak: (memRes.data as { streak: number } | null)?.streak ?? 0,
      };
    },
  });
}

export function useClaimMission() {
  const qc = useQueryClient();
  return useMutation<{ awarded_xp: number }, Error, string>({
    mutationFn: async (missionId) => {
      const { data, error } = await supabase.rpc('claim_mission', { p_mission_id: missionId });
      if (error) throw new Error(error.message);
      return data as { awarded_xp: number };
    },
    onSuccess: (data) => {
      toast(`+${data.awarded_xp} XP inlöst!`);
      qc.invalidateQueries({ queryKey: ['missions'] });
      qc.invalidateQueries({ queryKey: ['home'] });
    },
    onError: (e) => toast(e.message),
  });
}

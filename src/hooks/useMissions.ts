import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { announceNewBadges } from '@/lib/badgeSeen';
import { invalidateMemberData } from '@/lib/queries';
import { playSfx } from '@/lib/sfx';
import { supabase } from '@/lib/supabase';
import type { MissionWithProgress } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from '@/store/toast';

export type MissionsData = {
  missions: MissionWithProgress[];
  points: number;
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
          .select('points')
          .eq('forening_id', fid)
          .eq('user_id', userId as string)
          .maybeSingle(),
      ]);
      return {
        missions: (missionsRes.data as MissionWithProgress[]) ?? [],
        points: (memRes.data as { points: number } | null)?.points ?? 0,
      };
    },
  });
}

/** Lös in ett Mål ('goal') — progressen måste ha nått målet. */
export function useClaimMission() {
  const qc = useQueryClient();
  const { session, activeMembership } = useAuth();
  const userId = session?.user.id;
  const foreningId = activeMembership?.forening_id;
  return useMutation<{ awarded_xp: number }, Error, string>({
    mutationFn: async (missionId) => {
      const { data, error } = await supabase.rpc('claim_mission', { p_mission_id: missionId });
      if (error) throw new Error(error.message);
      return data as { awarded_xp: number };
    },
    onSuccess: (data) => {
      toast(`+${data.awarded_xp} XP inlöst!`);
      playSfx('coin');
      invalidateMemberData(qc);
      if (userId && foreningId) announceNewBadges(userId, foreningId);
    },
    onError: (e) => toast(e.message),
  });
}

/** Markera en Uppgift ('task') klar — självrapporterad, ger XP direkt. */
export function useCompleteTask() {
  const qc = useQueryClient();
  const { session, activeMembership } = useAuth();
  const userId = session?.user.id;
  const foreningId = activeMembership?.forening_id;
  return useMutation<{ awarded_xp: number }, Error, string>({
    mutationFn: async (missionId) => {
      const { data, error } = await supabase.rpc('complete_task', { p_mission_id: missionId });
      if (error) throw new Error(error.message);
      return data as { awarded_xp: number };
    },
    onSuccess: (data) => {
      toast(`Klart! +${data.awarded_xp} XP`);
      playSfx('coin');
      invalidateMemberData(qc);
      if (userId && foreningId) announceNewBadges(userId, foreningId);
    },
    onError: (e) => toast(e.message),
  });
}

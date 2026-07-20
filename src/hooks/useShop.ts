import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { announceNewBadges } from '@/lib/badgeSeen';
import { playSfx } from '@/lib/sfx';
import { supabase } from '@/lib/supabase';
import type { Reward } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from '@/store/toast';

export type ShopData = {
  rewards: Reward[];
  redeemedIds: Set<string>;
  points: number;
};

export function useShop(foreningId: string | null, userId: string | undefined) {
  return useQuery<ShopData>({
    queryKey: ['shop', foreningId, userId],
    enabled: !!foreningId && !!userId,
    queryFn: async () => {
      const fid = foreningId as string;
      const [rewardsRes, redRes, memRes] = await Promise.all([
        supabase.from('reward').select('*').eq('forening_id', fid).eq('active', true).order('cost', { ascending: true }),
        supabase.from('redemption').select('reward_id').eq('forening_id', fid),
        supabase.from('membership').select('points').eq('forening_id', fid).eq('user_id', userId as string).maybeSingle(),
      ]);
      const redeemedIds = new Set(((redRes.data as { reward_id: string }[]) ?? []).map((r) => r.reward_id));
      return {
        rewards: (rewardsRes.data as Reward[]) ?? [],
        redeemedIds,
        points: (memRes.data as { points: number } | null)?.points ?? 0,
      };
    },
  });
}

export function useRedeemReward() {
  const qc = useQueryClient();
  const { session, activeMembership } = useAuth();
  const userId = session?.user.id;
  const foreningId = activeMembership?.forening_id;
  return useMutation<{ title: string }, Error, string>({
    mutationFn: async (rewardId) => {
      const { data, error } = await supabase.rpc('redeem_reward', { p_reward_id: rewardId });
      if (error) throw new Error(error.message);
      return data as { title: string };
    },
    onSuccess: (data) => {
      toast(`${data.title} uttagen!`);
      playSfx('coin');
      qc.invalidateQueries({ queryKey: ['shop'] });
      qc.invalidateQueries({ queryKey: ['home'] });
      qc.invalidateQueries({ queryKey: ['profile'] });
      if (userId && foreningId) announceNewBadges(userId, foreningId);
    },
    onError: (e) => toast(e.message),
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { announceNewBadges } from '@/lib/badgeSeen';
import { invalidateMemberData } from '@/lib/queries';
import { playSfx } from '@/lib/sfx';
import { supabase } from '@/lib/supabase';
import type { ShopReward } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from '@/store/toast';

export type ShopData = {
  rewards: ShopReward[];
  points: number;
};

export function useShop(foreningId: string | null, userId: string | undefined) {
  return useQuery<ShopData>({
    queryKey: ['shop', foreningId, userId],
    enabled: !!foreningId && !!userId,
    queryFn: async () => {
      const fid = foreningId as string;
      // youth_shop is a function because RLS hides other members' redemptions —
      // a direct query would report every reward as untouched.
      const [shopRes, memRes] = await Promise.all([
        supabase.rpc('youth_shop', { p_forening: fid }),
        supabase.from('membership').select('points').eq('forening_id', fid).eq('user_id', userId as string).maybeSingle(),
      ]);
      return {
        rewards: (shopRes.data as ShopReward[]) ?? [],
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
      invalidateMemberData(qc);
      if (userId && foreningId) announceNewBadges(userId, foreningId);
    },
    onError: (e) => toast(e.message),
  });
}

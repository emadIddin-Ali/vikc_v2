import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { announceNewBadges } from '@/lib/badgeSeen';
import { invalidateMemberData } from '@/lib/queries';
import { playSfx } from '@/lib/sfx';
import { supabase } from '@/lib/supabase';
import type { MarknadStatus, ShopReward } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from '@/store/toast';

export type ShopData = {
  rewards: ShopReward[];
  points: number;
  marknad: MarknadStatus | null;
};

/**
 * The shop for the signed-in member, or for one of a parent's children.
 *
 * A child has no login, so its balance lives on the child row — passing
 * childId switches both the catalog's "already taken" counts and the balance
 * over to that child.
 */
export function useShop(foreningId: string | null, userId: string | undefined, childId: string | null = null) {
  return useQuery<ShopData>({
    queryKey: ['shop', foreningId, userId, childId],
    enabled: !!foreningId && !!userId,
    queryFn: async () => {
      const fid = foreningId as string;
      // youth_shop is a function because RLS hides other members' redemptions —
      // a direct query would report every reward as untouched.
      const [shopRes, marknadRes, saldoRes] = await Promise.all([
        supabase.rpc('youth_shop', { p_forening: fid, p_child: childId }),
        supabase.rpc('marknad_status', { p_forening: fid }),
        childId
          ? supabase.from('child').select('points').eq('id', childId).maybeSingle()
          : supabase.from('membership').select('points')
              .eq('forening_id', fid).eq('user_id', userId as string).maybeSingle(),
      ]);
      return {
        rewards: (shopRes.data as ShopReward[]) ?? [],
        marknad: (marknadRes.data as MarknadStatus) ?? null,
        points: (saldoRes.data as { points: number } | null)?.points ?? 0,
      };
    },
  });
}

export function useRedeemReward() {
  const qc = useQueryClient();
  const { session, activeMembership } = useAuth();
  const userId = session?.user.id;
  const foreningId = activeMembership?.forening_id;
  return useMutation<{ title: string }, Error, { rewardId: string; childId?: string | null }>({
    mutationFn: async ({ rewardId, childId }) => {
      const { data, error } = await supabase.rpc('redeem_reward', {
        p_reward_id: rewardId,
        p_child: childId ?? null,
      });
      if (error) throw new Error(error.message);
      return data as { title: string };
    },
    onSuccess: (data, vars) => {
      toast(`${data.title} uttagen!`);
      playSfx('coin');
      invalidateMemberData(qc);
      if (vars.childId) {
        qc.invalidateQueries({ queryKey: ['children'] });
        qc.invalidateQueries({ queryKey: ['child-redemptions'] });
      } else if (userId && foreningId) {
        announceNewBadges(userId, foreningId);
      }
    },
    onError: (e) => toast(e.message),
  });
}

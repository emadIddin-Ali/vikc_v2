import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { CountUp } from '@/components/ui/CountUp';
import { MarknadBanner } from '@/features/shop/MarknadBanner';
import { RewardGrid } from '@/features/shop/RewardGrid';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useRedeemReward, useShop } from '@/hooks/useShop';
import { colors, font, radius, shadow } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function Butik() {
  const { activeMembership, session } = useAuth();
  const fid = activeMembership?.forening_id ?? null;
  const { data, refetch } = useShop(fid, session?.user.id);
  useRefreshOnFocus(refetch);
  const redeem = useRedeemReward();

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Text style={styles.h1}>Butik</Text>
          <View style={styles.pointsChip}>
            <Icon name="coin" size={17} color={colors.primary} />
            <CountUp value={data?.points ?? 0} style={styles.pointsText} />
          </View>
        </View>
      }
    >
      <MarknadBanner marknad={data?.marknad ?? null} />

      <RewardGrid
        rewards={data?.rewards ?? []}
        points={data?.points ?? 0}
        busy={redeem.isPending}
        onRedeem={(rewardId) => redeem.mutate({ rewardId })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6 },
  h1: { fontFamily: font.bold, fontSize: 22, color: colors.ink },
  pointsChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white,
    borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, ...shadow.soft,
  },
  pointsText: { fontFamily: font.bold, fontSize: 15, color: colors.primary },
});

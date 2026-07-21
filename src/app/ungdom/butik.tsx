import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { CountUp } from '@/components/ui/CountUp';
import { FadeIn } from '@/components/ui/FadeIn';
import { Tappable } from '@/components/ui/Tappable';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { useRedeemReward, useShop } from '@/hooks/useShop';
import { useBrandGradient } from '@/hooks/useBrandGradient';
import { ICON_TINT, colors, font, gradients, shadow } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function Butik() {
  const brand = useBrandGradient();
  const { activeMembership, session } = useAuth();
  const fid = activeMembership?.forening_id ?? null;
  const { data, refetch } = useShop(fid, session?.user.id);
  useRefreshOnFocus(refetch);
  const redeem = useRedeemReward();

  const rewards = data?.rewards ?? [];
  const points = data?.points ?? 0;

  return (
    <Screen
      header={
        <View style={styles.header}>
          <Text style={styles.h1}>Butik</Text>
          <View style={styles.pointsChip}>
            <Icon name="coin" size={17} color={colors.primary} />
            <CountUp value={points} style={styles.pointsText} />
          </View>
        </View>
      }
    >

      <View style={styles.grid}>
        {rewards.map((r, i) => {
          const isRedeemed = r.mine;
          const left = r.stock == null ? null : Math.max(0, r.stock - r.taken);
          const soldOut = left === 0;
          const affordable = points >= r.cost;
          const tint = ICON_TINT[r.icon] ?? colors.primary;

          return (
            <FadeIn key={r.id} index={i} style={styles.rewardCell}>
            <Card style={[styles.rewardCard, { opacity: isRedeemed || soldOut ? 0.55 : 1 }]}>
              <View style={[styles.media, { backgroundColor: r.tint }]}>
                <Icon name={r.icon as any} size={32} color={tint} />
                {/* Scarcity is the point of a limited reward — say it on the tile. */}
                {left != null && !isRedeemed && (
                  <View style={[styles.stockPill, soldOut && { backgroundColor: colors.muted2 }]}>
                    <Text style={styles.stockText}>{soldOut ? 'Slut' : `${left} kvar`}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.rewardTitle}>{r.title}</Text>
              {!!r.tag && <Text style={styles.rewardTag}>{r.tag}</Text>}

              {isRedeemed ? (
                <View style={[styles.redeemBtn, { backgroundColor: colors.tintPurple2 }]}>
                  <Text style={[styles.redeemText, { color: colors.muted2 }]}>✓ Uttagen</Text>
                </View>
              ) : soldOut ? (
                <View style={[styles.redeemBtn, { backgroundColor: '#f4f2fb' }]}>
                  <Text style={[styles.redeemText, { color: colors.muted2 }]}>Slutsåld</Text>
                </View>
              ) : affordable ? (
                <Tappable disabled={redeem.isPending} scale={0.94} onPress={() => redeem.mutate(r.id)}>
                  <LinearGradient colors={brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.redeemBtn}>
                    <Icon name="coin" size={14} color={colors.white} />
                    <Text style={[styles.redeemText, { color: colors.white, marginLeft: 5 }]}>{r.cost}</Text>
                  </LinearGradient>
                </Tappable>
              ) : (
                <View style={[styles.redeemBtn, { backgroundColor: '#f4f2fb' }]}>
                  <Icon name="coin" size={14} color="#c3b8e0" />
                  <Text style={[styles.redeemText, { color: '#c3b8e0', marginLeft: 5 }]}>{r.cost}</Text>
                </View>
              )}
            </Card>
            </FadeIn>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontFamily: font.bold, fontSize: 22, color: colors.ink },
  pointsChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white,
    paddingVertical: 8, paddingHorizontal: 13, borderRadius: 20, ...shadow.soft,
  },
  pointsText: { fontFamily: font.bold, fontSize: 14, color: colors.primary },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16 },
  rewardCell: { width: '48%', marginBottom: 13 },
  rewardCard: { padding: 13 },
  stockPill: {
    position: 'absolute', top: 6, right: 6, backgroundColor: colors.ink,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3,
  },
  stockText: { fontFamily: font.bold, fontSize: 10, color: colors.white },
  media: { height: 74, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  rewardTitle: { fontFamily: font.semibold, fontSize: 13, color: colors.ink, marginTop: 9 },
  rewardTag: { fontFamily: font.regular, fontSize: 11, color: colors.muted2, marginTop: 1 },
  redeemBtn: {
    marginTop: 10, paddingVertical: 9, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  redeemText: { fontFamily: font.semibold, fontSize: 12.5 },
});

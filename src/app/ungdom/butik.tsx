import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { useRedeemReward, useShop } from '@/hooks/useShop';
import { ICON_TINT, colors, fmt, font, gradients, shadow } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function Butik() {
  const { activeMembership, session } = useAuth();
  const fid = activeMembership?.forening_id ?? null;
  const { data } = useShop(fid, session?.user.id);
  const redeem = useRedeemReward();

  const rewards = data?.rewards ?? [];
  const points = data?.points ?? 0;
  const redeemedIds = data?.redeemedIds ?? new Set<string>();

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.h1}>Butik</Text>
        <View style={styles.pointsChip}>
          <Icon name="coin" size={17} color={colors.primary} />
          <Text style={styles.pointsText}>{fmt(points)}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {rewards.map((r) => {
          const isRedeemed = redeemedIds.has(r.id);
          const affordable = points >= r.cost;
          const tint = ICON_TINT[r.icon] ?? colors.primary;

          return (
            <Card key={r.id} style={[styles.rewardCard, { opacity: isRedeemed ? 0.55 : 1 }]}>
              <View style={[styles.media, { backgroundColor: r.tint }]}>
                <Icon name={r.icon as any} size={32} color={tint} />
              </View>
              <Text style={styles.rewardTitle}>{r.title}</Text>
              {!!r.tag && <Text style={styles.rewardTag}>{r.tag}</Text>}

              {isRedeemed ? (
                <View style={[styles.redeemBtn, { backgroundColor: colors.tintPurple2 }]}>
                  <Text style={[styles.redeemText, { color: colors.muted2 }]}>✓ Uttagen</Text>
                </View>
              ) : affordable ? (
                <Pressable disabled={redeem.isPending} onPress={() => redeem.mutate(r.id)}>
                  <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.redeemBtn}>
                    <Icon name="coin" size={14} color={colors.white} />
                    <Text style={[styles.redeemText, { color: colors.white, marginLeft: 5 }]}>{r.cost}</Text>
                  </LinearGradient>
                </Pressable>
              ) : (
                <View style={[styles.redeemBtn, { backgroundColor: '#f4f2fb' }]}>
                  <Icon name="coin" size={14} color="#c3b8e0" />
                  <Text style={[styles.redeemText, { color: '#c3b8e0', marginLeft: 5 }]}>{r.cost}</Text>
                </View>
              )}
            </Card>
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
  rewardCard: { width: '48%', padding: 13, marginBottom: 13 },
  media: { height: 74, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  rewardTitle: { fontFamily: font.semibold, fontSize: 13, color: colors.ink, marginTop: 9 },
  rewardTag: { fontFamily: font.regular, fontSize: 11, color: colors.muted2, marginTop: 1 },
  redeemBtn: {
    marginTop: 10, paddingVertical: 9, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  redeemText: { fontFamily: font.semibold, fontSize: 12.5 },
});

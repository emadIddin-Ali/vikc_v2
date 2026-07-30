import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { MarknadBanner } from '@/features/shop/MarknadBanner';
import { RewardGrid } from '@/features/shop/RewardGrid';
import { useChildRedemptions } from '@/hooks/useParent';
import { useRedeemReward, useShop } from '@/hooks/useShop';
import type { Child } from '@/lib/types';
import { colors, font, radius, relativeDate } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

/**
 * The shop, on behalf of a child.
 *
 * A child has no login, so without this its points were a dead end — it could
 * earn stars and check-ins forever and never buy anything. The purchase is
 * charged to the child's balance, not the parent's.
 */
export function BarnButikModal({ child, onClose }: { child: Child; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { activeMembership, session } = useAuth();
  const fid = activeMembership?.forening_id ?? null;

  const { data } = useShop(fid, session?.user.id, child.id);
  const { data: kvitton } = useChildRedemptions(child.id);
  const redeem = useRedeemReward();

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.head}>
            <View style={{ width: 44 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>Butik</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{child.display_name}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.done}>Klar</Text>
            </Pressable>
          </View>

          <View style={styles.saldo}>
            <Icon name="coin" size={18} color={colors.primary} />
            <Text style={styles.saldoText}>{data?.points ?? child.points} poäng</Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            <MarknadBanner marknad={data?.marknad ?? null} />

            <RewardGrid
              rewards={data?.rewards ?? []}
              points={data?.points ?? 0}
              busy={redeem.isPending}
              onRedeem={(rewardId) => redeem.mutate({ rewardId, childId: child.id })}
            />

            {(kvitton ?? []).length > 0 && (
              <>
                <Text style={styles.section}>Hämtat</Text>
                {(kvitton ?? []).map((k) => (
                  <View key={k.id} style={styles.kvitto}>
                    <View style={styles.kvittoTile}>
                      <Icon name="gift" size={15} color={colors.green} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.kvittoTitle}>{k.title}</Text>
                      <Text style={styles.kvittoDate}>{relativeDate(k.created_at)}</Text>
                    </View>
                    <Text style={styles.kvittoCost}>−{k.cost} p</Text>
                  </View>
                ))}
                <Text style={styles.hint}>Visa listan för en ledare när ni hämtar ut.</Text>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.adminBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, height: '92%' },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 8 },
  title: { fontFamily: font.bold, fontSize: 15, color: colors.ink, textAlign: 'center' },
  subtitle: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2, textAlign: 'center' },
  done: { fontFamily: font.semibold, fontSize: 14, color: colors.primary, width: 44, textAlign: 'right' },

  saldo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.white, marginHorizontal: 18, borderRadius: radius.pill, paddingVertical: 10,
  },
  saldoText: { fontFamily: font.bold, fontSize: 15, color: colors.primary },

  body: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 20 },
  section: { fontFamily: font.bold, fontSize: 15, color: colors.ink, marginTop: 18, marginBottom: 4 },
  kvitto: {
    flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 8,
    backgroundColor: colors.white, borderRadius: radius.md, padding: 11,
  },
  kvittoTile: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.tintGreen, alignItems: 'center', justifyContent: 'center' },
  kvittoTitle: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  kvittoDate: { fontFamily: font.regular, fontSize: 11, color: colors.muted2 },
  kvittoCost: { fontFamily: font.bold, fontSize: 12.5, color: colors.muted },
  hint: { fontFamily: font.regular, fontSize: 11.5, color: colors.faint, marginTop: 12, textAlign: 'center' },
});

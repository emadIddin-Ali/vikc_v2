import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { FadeIn } from '@/components/ui/FadeIn';
import { Tappable } from '@/components/ui/Tappable';
import { useBrandGradient } from '@/hooks/useBrandGradient';
import type { ShopReward } from '@/lib/types';
import { ICON_TINT, colors, font, radius, shadow } from '@/theme/tokens';

/**
 * The reward catalog. Shared by the youth shop and the parent's shop for a
 * child, so a reward looks and behaves the same wherever it is bought.
 *
 * When markets are in use the grid splits in two: what is buyable now, and
 * what is waiting for the market. A single greyed-out grid made the shop look
 * broken rather than closed.
 */
export function RewardGrid({
  rewards,
  points,
  onRedeem,
  busy = false,
}: {
  rewards: ShopReward[];
  points: number;
  onRedeem: (rewardId: string) => void;
  busy?: boolean;
}) {
  const oppna = rewards.filter((r) => r.kopbar);
  const stangda = rewards.filter((r) => !r.kopbar);

  return (
    <>
      {stangda.length > 0 && oppna.length > 0 && <Text style={styles.section}>Öppet nu</Text>}
      <Grid rewards={oppna} points={points} onRedeem={onRedeem} busy={busy} />

      {stangda.length > 0 && (
        <>
          <Text style={styles.section}>Till marknaden</Text>
          <Grid rewards={stangda} points={points} onRedeem={onRedeem} busy={busy} />
        </>
      )}

      {rewards.length === 0 && (
        <Text style={styles.empty}>Inga belöningar upplagda än.</Text>
      )}
    </>
  );
}

function Grid({
  rewards, points, onRedeem, busy,
}: {
  rewards: ShopReward[];
  points: number;
  onRedeem: (rewardId: string) => void;
  busy: boolean;
}) {
  const brand = useBrandGradient();

  return (
    <View style={styles.grid}>
      {rewards.map((r, i) => {
        const left = r.stock == null ? null : Math.max(0, r.stock - r.taken);
        const soldOut = left === 0;
        const slut = r.limit_per_member != null && r.mina >= r.limit_per_member;
        const affordable = points >= r.cost;
        const tint = ICON_TINT[r.icon] ?? colors.primary;
        const dimmad = slut || soldOut || !r.kopbar;

        return (
          <FadeIn key={r.id} index={i} style={styles.cell}>
            <Card style={[styles.card, { opacity: dimmad ? 0.55 : 1 }]}>
              <View style={[styles.media, { backgroundColor: r.tint }]}>
                <Icon name={r.icon as any} size={32} color={tint} />
                {/* Scarcity is the point of a limited reward — say it on the tile. */}
                {left != null && !slut && (
                  <View style={[styles.stockPill, soldOut && { backgroundColor: colors.muted2 }]}>
                    <Text style={styles.stockText}>{soldOut ? 'Slut' : `${left} kvar`}</Text>
                  </View>
                )}
              </View>

              <Text style={styles.title}>{r.title}</Text>
              <Text style={styles.tag}>
                {r.tag
                  || (r.limit_per_member == null
                    ? 'Kan köpas flera gånger'
                    : r.mina > 0 ? `Hämtad ${r.mina} av ${r.limit_per_member}` : '')}
              </Text>

              {!r.kopbar ? (
                <View style={[styles.btn, { backgroundColor: colors.tintPurple2 }]}>
                  <Icon name="calendar" size={13} color={colors.muted2} />
                  <Text style={[styles.btnText, { color: colors.muted2, marginLeft: 5 }]}>På marknaden</Text>
                </View>
              ) : slut ? (
                <View style={[styles.btn, { backgroundColor: colors.tintPurple2 }]}>
                  <Text style={[styles.btnText, { color: colors.muted2 }]}>✓ Uttagen</Text>
                </View>
              ) : soldOut ? (
                <View style={[styles.btn, { backgroundColor: '#f4f2fb' }]}>
                  <Text style={[styles.btnText, { color: colors.muted2 }]}>Slutsåld</Text>
                </View>
              ) : affordable ? (
                <Tappable disabled={busy} scale={0.94} onPress={() => onRedeem(r.id)}>
                  <LinearGradient colors={brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
                    <Icon name="coin" size={14} color={colors.white} />
                    <Text style={[styles.btnText, { color: colors.white, marginLeft: 5 }]}>{r.cost}</Text>
                  </LinearGradient>
                </Tappable>
              ) : (
                <View style={[styles.btn, { backgroundColor: '#f4f2fb' }]}>
                  <Icon name="coin" size={14} color="#c3b8e0" />
                  <Text style={[styles.btnText, { color: '#c3b8e0', marginLeft: 5 }]}>{r.cost}</Text>
                </View>
              )}
            </Card>
          </FadeIn>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: font.bold, fontSize: 15, color: colors.ink, marginTop: 20, marginBottom: 2 },
  empty: { fontFamily: font.regular, fontSize: 13, color: colors.muted2, textAlign: 'center', marginTop: 26 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 8 },
  cell: { width: '48%' },
  card: { padding: 12, marginBottom: 12, ...shadow.soft },
  media: {
    height: 84, borderRadius: radius.tile, alignItems: 'center', justifyContent: 'center', marginBottom: 9,
  },
  stockPill: {
    position: 'absolute', top: 7, right: 7, backgroundColor: colors.orange,
    borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3,
  },
  stockText: { fontFamily: font.semibold, fontSize: 10, color: colors.white },
  title: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  tag: { fontFamily: font.regular, fontSize: 10.5, color: colors.muted2, marginTop: 1, minHeight: 14 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.sm, paddingVertical: 9, marginTop: 9,
  },
  btnText: { fontFamily: font.semibold, fontSize: 12.5 },
});

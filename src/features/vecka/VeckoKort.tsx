import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { useMinVecka } from '@/hooks/useLeaderboard';
import { colors, font, radius } from '@/theme/tokens';

/**
 * "Din vecka" — the app's heartbeat.
 *
 * Everything else on the home screen is either all-time (level, points) or
 * about the venue (activities). Without a card that resets on Monday there is
 * nothing that says *this week matters*, and the weekly goal would be a rule
 * nobody could see themselves progressing against.
 */
export function VeckoKort({ foreningId, childId = null }: { foreningId: string | null; childId?: string | null }) {
  const { data } = useMinVecka(foreningId, childId);
  if (!data) return null;

  const mal = data.veckomal;
  const kvar = Math.max(0, mal - data.besok_vecka);
  const andel = mal > 0 ? Math.min(1, data.besok_vecka / mal) : 0;

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Din vecka</Text>
        {data.veckosvit > 0 && (
          <View style={styles.streak}>
            <Icon name="fire" size={15} color={colors.orange} />
            <Text style={styles.streakText}>
              {data.veckosvit} {data.veckosvit === 1 ? 'vecka' : 'veckor'} i rad
            </Text>
          </View>
        )}
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{data.xp_vecka}</Text>
          <Text style={styles.statLabel}>XP denna vecka</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{data.sasong_xp}</Text>
          <Text style={styles.statLabel}>XP i säsongen</Text>
        </View>
      </View>

      {mal > 0 && (
        <>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${andel * 100}%` }, data.klart && { backgroundColor: colors.green }]} />
          </View>
          <Text style={styles.goal}>
            {data.klart
              ? `Veckans mål är klart — +${data.veckomal_xp} XP inräknat.`
              : kvar === 1
                ? `Ett besök till den här veckan ger +${data.veckomal_xp} XP.`
                : `${kvar} besök till den här veckan ger +${data.veckomal_xp} XP.`}
          </Text>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 15, marginTop: 14 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: font.bold, fontSize: 15, color: colors.ink },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  streakText: { fontFamily: font.semibold, fontSize: 11.5, color: colors.orange },

  stats: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  stat: { flex: 1, alignItems: 'center' },
  divider: { width: 1, height: 28, backgroundColor: colors.navBorder },
  statValue: { fontFamily: font.bold, fontSize: 20, color: colors.primary },
  statLabel: { fontFamily: font.regular, fontSize: 11, color: colors.muted2, marginTop: 1 },

  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.tintPurple2, marginTop: 14, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
  goal: { fontFamily: font.medium, fontSize: 11.5, color: colors.muted, marginTop: 7 },
});

import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeIn } from '@/components/ui/FadeIn';
import { Tappable } from '@/components/ui/Tappable';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { colors, font, shadow } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function ForalderTopplista() {
  const router = useRouter();
  const { activeMembership } = useAuth();
  const { data } = useLeaderboard(activeMembership?.forening_id ?? null);
  const rows = data?.entries ?? [];

  return (
    <Screen
      header={
        <View style={styles.topRow}>
          <Tappable onPress={() => router.back()} hitSlop={10} scale={0.9} style={styles.back}>
            <Icon name="arrowL" size={18} color={colors.ink} />
          </Tappable>
          <Text style={styles.h1}>Topplista</Text>
        </View>
      }
    >
      <Text style={styles.intro}>
        Säsongens ställning i föreningen, räknad i XP. Dina barn är markerade.
      </Text>

      {rows.length === 0 && <EmptyState icon="trophy" title="Ingen topplista än" body="Så fort någon samlar XP dyker rankningen upp här." />}

      {rows.map((r, i) => (
        <FadeIn key={`${r.rank}-${r.name}`} index={i}>
          <View style={[styles.row, r.is_me && styles.rowMe]}>
            <Text style={[styles.rank, r.is_me && { color: colors.primary }]}>{r.rank}</Text>
            <View style={[styles.avatar, { backgroundColor: r.avatar_color }]}>
              <Text style={styles.avatarText}>{r.name.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={[styles.name, r.is_me && { color: colors.primary }]} numberOfLines={1}>{r.name}</Text>
            <Text style={[styles.points, r.is_me && { color: colors.primary }]}>{r.xp} XP</Text>
          </View>
        </FadeIn>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadow.soft },
  h1: { fontFamily: font.bold, fontSize: 22, color: colors.ink },
  intro: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 4, marginBottom: 6 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 13, marginTop: 9 },
  rowMe: { backgroundColor: '#ede7ff', borderWidth: 2, borderColor: colors.primary },
  rank: { fontFamily: font.bold, fontSize: 15, color: colors.muted, width: 26, textAlign: 'center' },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.bold, fontSize: 15, color: colors.white },
  name: { flex: 1, fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  points: { fontFamily: font.bold, fontSize: 13.5, color: colors.primary },
});

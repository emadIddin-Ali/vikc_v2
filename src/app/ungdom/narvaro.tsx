import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeIn } from '@/components/ui/FadeIn';
import { Tappable } from '@/components/ui/Tappable';
import { useAttendanceList, useProfileData } from '@/hooks/useProfile';
import { fmtDateTime } from '@/lib/date';
import { useBrandGradient } from '@/hooks/useBrandGradient';
import { colors, font, gradients, radius, shadow } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function Narvaro() {
  const brand = useBrandGradient();
  const router = useRouter();
  const { session, activeMembership } = useAuth();
  const foreningId = activeMembership?.forening_id ?? null;
  const userId = session?.user.id;

  const { data: profile } = useProfileData(foreningId, userId);
  const { data: list } = useAttendanceList(foreningId, userId);

  const visits = profile?.stats.visits ?? activeMembership?.visits ?? 0;
  const monthCount = profile?.monthCount ?? 0;
  const checkins = list ?? [];
  const forening = activeMembership?.forening?.name ?? '';

  return (
    <Screen>
      <View style={styles.titleRow}>
        <Tappable onPress={() => router.back()} hitSlop={10} scale={0.9} style={styles.back}>
          <Icon name="arrowL" size={18} color={colors.ink} />
        </Tappable>
        <View>
          <Text style={styles.h1}>Min närvaro</Text>
          <Text style={styles.sub}>{forening}</Text>
        </View>
      </View>

      <View style={styles.duo}>
        <LinearGradient colors={brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bigStat}>
          <Text style={styles.bigValue}>{visits}</Text>
          <Text style={styles.bigLabel}>Besök totalt</Text>
        </LinearGradient>
        <LinearGradient colors={gradients.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bigStat}>
          <Text style={styles.bigValue}>{monthCount}</Text>
          <Text style={styles.bigLabel}>Denna månad</Text>
        </LinearGradient>
      </View>

      <Text style={styles.section}>Incheckningar</Text>
      {checkins.length === 0 ? (
        <EmptyState icon="pin" title="Inga incheckningar än" body="Varje gång du skannar QR-koden på gården hamnar besöket här." actionLabel="Checka in" onPress={() => router.push('/scan')} />
      ) : (
        checkins.map((c, i) => (
          <FadeIn key={c.id} index={i}>
            <Card style={styles.row}>
              <View style={styles.tile}>
                <Icon name="check" size={18} color={colors.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{c.title ?? 'Incheckning'}</Text>
                <Text style={styles.rowDate}>{fmtDateTime(new Date(c.created_at))}</Text>
              </View>
              <Text style={styles.rowPts}>+{c.awarded_points}</Text>
            </Card>
          </FadeIn>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', ...shadow.soft,
  },
  h1: { fontFamily: font.bold, fontSize: 22, color: colors.ink },
  sub: { fontFamily: font.regular, fontSize: 12, color: colors.muted2, marginTop: 1 },

  duo: { flexDirection: 'row', gap: 12, marginTop: 18 },
  bigStat: { flex: 1, borderRadius: radius.card, paddingVertical: 18, paddingHorizontal: 16, ...shadow.card },
  bigValue: { fontFamily: font.bold, fontSize: 30, color: colors.white },
  bigLabel: { fontFamily: font.medium, fontSize: 12, color: 'rgba(255,255,255,0.92)', marginTop: 2 },

  section: { fontFamily: font.semibold, fontSize: 14, color: colors.ink, marginTop: 22, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, marginTop: 11 },
  tile: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.tintGreen, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  rowDate: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2, marginTop: 1 },
  rowPts: { fontFamily: font.bold, fontSize: 13, color: colors.primary },
});

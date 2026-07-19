import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon, IconName } from '@/components/Icon';
import type { LedareTab } from '@/features/ledare/types';
import { fmtDateTime } from '@/lib/date';
import {
  useLedareActivities, useLedareOverview, useLedareRecentCheckins, useLedareYouth,
} from '@/hooks/useLedare';
import { colors, fmt, font } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

type Detail = null | 'checkins' | 'youth' | 'activities';

export function Oversikt({ fid, onNavigate }: { fid: string; onNavigate: (t: LedareTab) => void }) {
  const { signOut } = useAuth();
  const { data } = useLedareOverview(fid);
  const [detail, setDetail] = useState<Detail>(null);

  const k = data ?? { checked_today: 0, awarded_today: 0, youth: 0, activities: 0 };

  const kpis: { v: string; label: string; color: string; detail: Detail }[] = [
    { v: String(k.checked_today), label: 'incheckade idag', color: colors.primary, detail: 'checkins' },
    { v: fmt(k.awarded_today), label: 'poäng utdelade idag', color: colors.green, detail: 'checkins' },
    { v: String(k.youth), label: 'aktiva ungdomar', color: colors.orange, detail: 'youth' },
    { v: String(k.activities), label: 'aktiviteter', color: colors.ink, detail: 'activities' },
  ];

  if (detail) return <DetailPanel fid={fid} detail={detail} onBack={() => setDetail(null)} />;

  const actions: { icon: IconName; label: string; tab: LedareTab }[] = [
    { icon: 'check', label: 'Ta närvaro manuellt', tab: 'narvaro' },
    { icon: 'pin', label: 'Lägg upp aktivitet', tab: 'aktiviteter' },
    { icon: 'gift', label: 'Hantera belöningar', tab: 'beloningar' },
  ];

  return (
    <View>
      <View style={styles.grid}>
        {kpis.map((kpi, i) => (
          <Pressable key={i} style={styles.kpiWrap} onPress={() => setDetail(kpi.detail)}>
            <Card style={styles.kpi}>
              <View style={styles.kpiTop}>
                <Text style={[styles.kpiV, { color: kpi.color }]}>{kpi.v}</Text>
                <Icon name="chev" size={16} color={colors.faint} />
              </View>
              <Text style={styles.kpiL}>{kpi.label}</Text>
            </Card>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>Snabbåtgärder</Text>
      {actions.map((a, i) => (
        <Pressable key={i} onPress={() => onNavigate(a.tab)}>
          <Card style={styles.action}>
            <Icon name={a.icon} size={20} color={colors.primary} />
            <Text style={styles.actionLabel}>{a.label}</Text>
            <Icon name="chev" size={18} color={colors.primary} />
          </Card>
        </Pressable>
      ))}

      <Pressable onPress={signOut} style={styles.logout}>
        <Text style={styles.logoutText}>Logga ut</Text>
      </Pressable>
    </View>
  );
}

function DetailPanel({ fid, detail, onBack }: { fid: string; detail: Exclude<Detail, null>; onBack: () => void }) {
  const title =
    detail === 'checkins' ? 'Senaste aktiva' : detail === 'youth' ? 'Aktiva ungdomar' : 'Aktiviteter';

  const recent = useLedareRecentCheckins(detail === 'checkins' ? fid : null);
  const youth = useLedareYouth(detail === 'youth' ? fid : null);
  const activities = useLedareActivities(detail === 'activities' ? fid : null);

  return (
    <View>
      <View style={styles.detailHeader}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Icon name="arrowL" size={18} color={colors.ink} />
        </Pressable>
        <Text style={styles.detailTitle}>{title}</Text>
      </View>

      {detail === 'checkins' &&
        ((recent.data ?? []).length === 0 ? (
          <Text style={styles.empty}>Ingen aktivitet än.</Text>
        ) : (
          (recent.data ?? []).map((c, i) => (
            <Card key={i} style={styles.row}>
              {c.photo_url ? (
                <Image source={{ uri: c.photo_url }} style={styles.photo} />
              ) : (
                <View style={[styles.tile, { backgroundColor: colors.tintPurple }]}>
                  <Icon name="check" size={18} color={colors.primary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{c.name}</Text>
                <Text style={styles.rowSub}>{c.title} · {fmtDateTime(new Date(c.at))}</Text>
              </View>
              <Text style={styles.rowPts}>+{c.points}p</Text>
            </Card>
          ))
        ))}

      {detail === 'youth' &&
        (youth.data ?? []).map((y) => (
          <Card key={y.user_id} style={styles.row}>
            <View style={[styles.tile, { backgroundColor: y.avatar_color, borderRadius: 19 }]}>
              <Text style={styles.tileInit}>{y.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{y.name}</Text>
              <Text style={styles.rowSub}>{y.visits} besök</Text>
            </View>
            {y.present_today && <Text style={[styles.rowPts, { color: colors.green }]}>här idag</Text>}
          </Card>
        ))}

      {detail === 'activities' &&
        (activities.data ?? []).map((a) => (
          <Card key={a.id} style={styles.row}>
            <View style={[styles.tile, { backgroundColor: colors.tintOrange2 }]}>
              <Icon name="pin" size={18} color={colors.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{a.title}</Text>
              <Text style={styles.rowSub}>{a.when_text || 'Tid ej satt'}</Text>
            </View>
            <Text style={styles.rowPts}>+{a.points}p</Text>
          </Card>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  kpiWrap: { width: '48%', marginBottom: 11 },
  kpi: { padding: 15 },
  kpiTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  kpiV: { fontFamily: font.bold, fontSize: 24 },
  kpiL: { fontFamily: font.regular, fontSize: 11, color: colors.muted2, marginTop: 2 },
  section: { fontFamily: font.semibold, fontSize: 14, color: colors.ink, marginTop: 8, marginBottom: 11 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 10 },
  actionLabel: { flex: 1, fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  logout: { alignItems: 'center', marginTop: 18, paddingVertical: 8 },
  logoutText: { fontFamily: font.semibold, fontSize: 13, color: colors.muted },

  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  backBtn: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  detailTitle: { fontFamily: font.bold, fontSize: 18, color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 11 },
  tile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  photo: { width: 38, height: 38, borderRadius: 12 },
  tileInit: { fontFamily: font.semibold, fontSize: 14, color: colors.white },
  rowTitle: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  rowSub: { fontFamily: font.regular, fontSize: 11, color: colors.muted2 },
  rowPts: { fontFamily: font.bold, fontSize: 13, color: colors.primary },
  empty: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 12 },
});

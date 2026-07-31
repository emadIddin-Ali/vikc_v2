import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/ui/TextField';
import { useCreateForening, useKommunOverview } from '@/hooks/useKommun';
import { useRefreshAll } from '@/hooks/useRefreshAll';
import { colors, font } from '@/theme/tokens';
import { toast } from '@/store/toast';
import { useAuth } from '@/providers/AuthProvider';

export default function KommunHome() {
  const insets = useSafeAreaInsets();
  const { refreshing, onRefresh } = useRefreshAll();
  const router = useRouter();
  const { signOut, openForeningAsLeader } = useAuth();
  const { data } = useKommunOverview();
  const create = useCreateForening();
  const [name, setName] = useState('');

  const list = data ?? [];
  const totYouth = list.reduce((n, f) => n + f.youth, 0);
  const totCheckins = list.reduce((n, f) => n + f.checkins_today, 0);

  const kpis = [
    { v: String(list.length), label: 'föreningar', color: colors.primary },
    { v: String(totYouth), label: 'ungdomar', color: colors.orange },
    { v: String(totCheckins), label: 'incheckn. idag', color: colors.green },
  ];

  const onCreate = () => {
    if (!name.trim()) return toast('Skriv ett namn');
    create.mutate({ name: name.trim(), color: colors.primary }, { onSuccess: () => setName('') });
  };

  const openAsLeader = (f: (typeof list)[number]) => {
    openForeningAsLeader(f);
    router.replace('/ledare');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Kommun · superadmin</Text>
          <Text style={styles.title}>Alla föreningar</Text>
        </View>
        <Pressable onPress={signOut} hitSlop={8}>
          <Text style={styles.logout}>Logga ut</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <View style={styles.grid}>
          {kpis.map((k, i) => (
            <Card key={i} style={styles.kpi}>
              <Text style={[styles.kpiV, { color: k.color }]}>{k.v}</Text>
              <Text style={styles.kpiL}>{k.label}</Text>
            </Card>
          ))}
        </View>

        <View style={styles.info}>
          <View style={styles.shield}>
            <Icon name="shield" size={20} color={colors.primary} />
          </View>
          <Text style={styles.infoText}>
            Varje förening har <Text style={styles.b}>helt separat data</Text>. Ungdomar, poäng och topplistor blandas aldrig mellan föreningar.
          </Text>
        </View>

        <Text style={styles.section}>Föreningar</Text>
        {list.map((f) => (
          <Card key={f.id} style={styles.fCard}>
            <View style={styles.fTop}>
              <View style={[styles.fIcon, { backgroundColor: f.color }]}>
                <Icon name="org" size={22} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fName}>{f.name}</Text>
                <Text style={styles.fSub}>{f.youth} ungdomar · {f.activities} aktiviteter · {f.checkins_today} idag</Text>
                {!!f.join_code && <Text style={styles.fCode}>Kod: {f.join_code}</Text>}
              </View>
            </View>
            <Pressable style={styles.openBtn} onPress={() => openAsLeader(f)}>
              <Icon name="wrench" size={14} color={colors.white} />
              <Text style={styles.openText}>Öppna som ledare</Text>
            </Pressable>
          </Card>
        ))}
        {list.length === 0 && <Text style={styles.empty}>Inga föreningar än.</Text>}

        <Card style={styles.createCard}>
          <Text style={styles.createTitle}>Skapa förening</Text>
          <TextField placeholder="Namn, t.ex. Fritidsgården Öster" value={name} onChangeText={setName} style={{ marginTop: 10 }} />
          <Pressable disabled={create.isPending} onPress={onCreate} style={styles.createBtn}>
            <Text style={styles.createBtnText}>Skapa förening</Text>
          </Pressable>
          <Text style={styles.createHint}>En slumpad anslutningskod skapas automatiskt.</Text>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.adminBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 8 },
  kicker: { fontFamily: font.medium, fontSize: 12, color: colors.muted },
  title: { fontFamily: font.bold, fontSize: 19, color: colors.ink },
  logout: { fontFamily: font.semibold, fontSize: 13, color: colors.muted },
  content: { paddingHorizontal: 18 },

  grid: { flexDirection: 'row', gap: 10 },
  kpi: { flex: 1, padding: 14 },
  kpiV: { fontFamily: font.bold, fontSize: 20 },
  kpiL: { fontFamily: font.regular, fontSize: 10.5, color: colors.muted2, marginTop: 2 },

  info: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#ece9ff', borderRadius: 16, padding: 13, marginTop: 13 },
  shield: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  infoText: { flex: 1, fontFamily: font.regular, fontSize: 11.5, color: '#5b4b86', lineHeight: 16 },
  b: { fontFamily: font.bold },

  section: { fontFamily: font.semibold, fontSize: 14, color: colors.ink, marginTop: 18, marginBottom: 4 },
  fCard: { padding: 14, marginTop: 11 },
  fTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  fIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  fName: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  fSub: { fontFamily: font.regular, fontSize: 11, color: colors.muted2, marginTop: 1 },
  fCode: { fontFamily: font.medium, fontSize: 10.5, color: colors.faint, marginTop: 2 },
  openBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 11, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.ink },
  openText: { fontFamily: font.semibold, fontSize: 12.5, color: colors.white },

  createCard: { padding: 15, marginTop: 18 },
  createTitle: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  createBtn: { marginTop: 11, paddingVertical: 12, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center' },
  createBtnText: { fontFamily: font.semibold, fontSize: 13.5, color: colors.white },
  createHint: { fontFamily: font.regular, fontSize: 11, color: colors.muted2, marginTop: 8, textAlign: 'center' },

  empty: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 12 },
});

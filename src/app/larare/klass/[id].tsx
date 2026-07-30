import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeIn } from '@/components/ui/FadeIn';
import { Tappable } from '@/components/ui/Tappable';
import { ElevHistorik } from '@/features/larare/ElevHistorik';
import { ElevlistaModal } from '@/features/larare/ElevlistaModal';
import { KlassModal } from '@/features/larare/KlassModal';
import { StarCount } from '@/features/larare/Stars';
import { useKlassElever, useKlassTopplista, useLarareKlasser, useStartLektion } from '@/hooks/useLarare';
import { useRefreshAll } from '@/hooks/useRefreshAll';
import { klassWhen } from '@/lib/stars';
import type { KlassElev } from '@/lib/types';
import { colors, font, radius } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function KlassDetalj() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeForeningId } = useAuth();
  const klassId = id ?? null;

  const { data: klasser } = useLarareKlasser(activeForeningId);
  const klass = (klasser ?? []).find((k) => k.id === klassId) ?? null;

  const { data: elever, isLoading } = useKlassElever(klassId);
  const { data: topp } = useKlassTopplista(klassId);
  const startLektion = useStartLektion();
  const { refreshing, onRefresh } = useRefreshAll();

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [valdElev, setValdElev] = useState<KlassElev | null>(null);

  const openLektion = () => {
    if (!klassId) return;
    if (klass?.oppen_lektion) {
      router.push(`/larare/lektion/${klass.oppen_lektion}`);
      return;
    }
    startLektion.mutate({ klass: klassId }, { onSuccess: (l) => router.push(`/larare/lektion/${l.id}`) });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <Tappable scale={0.88} hitSlop={8} onPress={() => router.back()} style={styles.iconBtn}>
          <Icon name="arrowL" size={18} color={colors.ink} />
        </Tappable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{klass?.name ?? 'Klass'}</Text>
          <Text style={styles.subtitle}>
            {klassWhen(klass?.weekday ?? null, klass?.time_text ?? null)}
            {klass?.description ? ` · ${klass.description}` : ''}
          </Text>
        </View>
        <Tappable scale={0.88} hitSlop={8} onPress={() => setEditOpen(true)} style={styles.iconBtn}>
          <Icon name="wrench" size={17} color={colors.ink} />
        </Tappable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        <View style={styles.actions}>
          <Tappable
            scale={0.95}
            containerStyle={{ flex: 1 }}
            style={[styles.action, { backgroundColor: klass?.oppen_lektion ? colors.green : colors.ink }]}
            onPress={openLektion}
            disabled={startLektion.isPending}
          >
            <Icon name="calendar" size={15} color={colors.white} />
            <Text style={styles.actionText}>
              {klass?.oppen_lektion ? 'Fortsätt lektionen' : 'Starta lektion'}
            </Text>
          </Tappable>
          <Tappable
            scale={0.95}
            containerStyle={{ flex: 1 }}
            style={[styles.action, styles.actionLight]}
            onPress={() => setAddOpen(true)}
          >
            <Icon name="user" size={15} color={colors.ink} />
            <Text style={[styles.actionText, { color: colors.ink }]}>Hantera elever</Text>
          </Tappable>
        </View>

        <Text style={styles.sectionTitle}>
          Elever {elever?.length ? `(${elever.length})` : ''}
        </Text>

        {(elever ?? []).length === 0 && !isLoading ? (
          <EmptyState
            icon="user"
            title="Inga elever än"
            body="Bocka i elever ur föreningen, eller dela klasskoden så går de med själva."
            actionLabel="Hantera elever"
            onPress={() => setAddOpen(true)}
          />
        ) : (
          (elever ?? []).map((e, i) => (
            <FadeIn key={e.id} index={i}>
              <Tappable style={styles.elevCard} onPress={() => setValdElev(e)}>
                <View style={[styles.avatar, { backgroundColor: e.avatar_color }]}>
                  <Text style={styles.avatarText}>{e.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.elevName} numberOfLines={1}>{e.name}</Text>
                  <Text style={styles.elevMeta}>
                    Nivå {e.level} · {e.stjarnor_totalt}★ totalt
                  </Text>
                </View>
                <StarCount value={e.stjarnor_veckan} />
                <Icon name="chev" size={16} color={colors.faint} />
              </Tappable>
            </FadeIn>
          ))
        )}

        {(topp ?? []).length > 1 && (
          <>
            <Text style={styles.sectionTitle}>Veckans topplista</Text>
            <Card style={styles.toppCard}>
              {(topp ?? []).slice(0, 10).map((r) => (
                <View key={`${r.rank}-${r.name}`} style={styles.toppRow}>
                  <Text style={styles.toppRank}>{r.rank}</Text>
                  <View style={[styles.toppDot, { backgroundColor: r.avatar_color }]} />
                  <Text style={styles.toppName} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.toppStars}>{r.stjarnor}★</Text>
                </View>
              ))}
              <Text style={styles.toppHint}>Nollställs varje måndag, så alla kan vinna.</Text>
            </Card>
          </>
        )}
      </ScrollView>

      {addOpen && klassId && activeForeningId && (
        <ElevlistaModal
          klass={klassId}
          klassName={klass?.name ?? 'Klass'}
          forening={activeForeningId}
          onClose={() => setAddOpen(false)}
        />
      )}
      {editOpen && klass && activeForeningId && (
        <KlassModal forening={activeForeningId} klass={klass} onClose={() => setEditOpen(false)} />
      )}
      {valdElev && <ElevHistorik elev={valdElev} onClose={() => setValdElev(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.adminBg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 6 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: font.bold, fontSize: 18, color: colors.ink },
  subtitle: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2, marginTop: 1 },
  content: { paddingHorizontal: 18, paddingTop: 10 },

  actions: { flexDirection: 'row', gap: 10 },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: radius.sm, paddingVertical: 12 },
  actionLight: { backgroundColor: colors.white },
  actionText: { fontFamily: font.semibold, fontSize: 13, color: colors.white },

  sectionTitle: { fontFamily: font.bold, fontSize: 15.5, color: colors.ink, marginTop: 22 },

  elevCard: {
    flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 10,
    backgroundColor: colors.white, borderRadius: radius.md, padding: 12,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.bold, fontSize: 16, color: colors.white },
  elevName: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  elevMeta: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2, marginTop: 1 },

  toppCard: { marginTop: 10, padding: 14 },
  toppRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  toppRank: { fontFamily: font.bold, fontSize: 13, color: colors.muted, width: 20 },
  toppDot: { width: 26, height: 26, borderRadius: 13 },
  toppName: { fontFamily: font.medium, fontSize: 13.5, color: colors.ink, flex: 1 },
  toppStars: { fontFamily: font.bold, fontSize: 13, color: colors.ink },
  toppHint: { fontFamily: font.regular, fontSize: 11, color: colors.faint, marginTop: 8 },
});

import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { FadeIn } from '@/components/ui/FadeIn';
import { Tappable } from '@/components/ui/Tappable';
import { KlassModal } from '@/features/larare/KlassModal';
import { StarCount } from '@/features/larare/Stars';
import { useLarareKlasser, useStartLektion } from '@/hooks/useLarare';
import { useRefreshAll } from '@/hooks/useRefreshAll';
import { klassWhen } from '@/lib/stars';
import type { LarareKlass } from '@/lib/types';
import { colors, font, radius } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function LarareHem() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeForening, activeForeningId, activeMembership, profile, session, signOut } = useAuth();
  const fid = activeForeningId;
  const godkand = activeMembership?.larare_godkand !== false;

  const { data: klasser, isLoading } = useLarareKlasser(godkand ? fid : null);
  const startLektion = useStartLektion();
  const { refreshing, onRefresh } = useRefreshAll();
  const [nyKlass, setNyKlass] = useState(false);

  const name = (profile?.display_name?.trim() || session?.user?.email?.split('@')[0] || 'lärare').split(' ')[0];

  const openLektion = (k: LarareKlass) => {
    if (k.oppen_lektion) {
      router.push(`/larare/lektion/${k.oppen_lektion}`);
      return;
    }
    startLektion.mutate(
      { klass: k.id },
      { onSuccess: (l) => router.push(`/larare/lektion/${l.id}`) },
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker} numberOfLines={1}>Lärarvy · {activeForening?.name ?? ''}</Text>
          <Text style={styles.hej}>Hej {name}</Text>
        </View>
        <Pressable onPress={signOut} hitSlop={8}>
          <Text style={styles.logout}>Logga ut</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {!godkand ? (
          <Card style={styles.pending}>
            <View style={styles.pendingTile}>
              <Icon name="shield" size={22} color={colors.orange} />
            </View>
            <Text style={styles.pendingTitle}>Väntar på godkännande</Text>
            <Text style={styles.pendingBody}>
              En ledare i {activeForening?.name ?? 'föreningen'} behöver godkänna dig som lärare innan du kan
              skapa klasser. De har fått en notis — hör av dig om det dröjer.
            </Text>
          </Card>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Mina klasser</Text>
              <Pressable onPress={() => setNyKlass(true)} hitSlop={6}>
                <Text style={styles.addLink}>+ Ny klass</Text>
              </Pressable>
            </View>

            {(klasser ?? []).length === 0 && !isLoading ? (
              <EmptyState
                icon="book"
                title="Ingen klass än"
                body="Skapa din första klass och lägg till eleverna du undervisar."
                actionLabel="Skapa klass"
                onPress={() => setNyKlass(true)}
              />
            ) : (
              (klasser ?? []).map((k, i) => (
                <FadeIn key={k.id} index={i}>
                  <Card style={styles.klassCard}>
                    <Tappable
                      containerStyle={{ flex: 1 }}
                      style={styles.klassMain}
                      onPress={() => router.push(`/larare/klass/${k.id}`)}
                    >
                      <View style={[styles.dot, { backgroundColor: k.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.klassName} numberOfLines={1}>{k.name}</Text>
                        <Text style={styles.klassMeta}>
                          {klassWhen(k.weekday, k.time_text)} · {k.elever} {k.elever === 1 ? 'elev' : 'elever'}
                        </Text>
                      </View>
                      <StarCount value={k.stjarnor_veckan} />
                    </Tappable>

                    <Tappable
                      scale={0.94}
                      style={[styles.startBtn, k.oppen_lektion ? styles.startBtnOpen : null]}
                      onPress={() => openLektion(k)}
                      disabled={startLektion.isPending}
                    >
                      <Icon name={k.oppen_lektion ? 'arrowL' : 'calendar'} size={15} color={colors.white} />
                      <Text style={styles.startText}>
                        {k.oppen_lektion ? 'Fortsätt lektionen' : 'Starta lektion'}
                      </Text>
                    </Tappable>
                  </Card>
                </FadeIn>
              ))
            )}

            <Text style={styles.foot}>
              Stjärnorna räknas per vecka. Eleverna får XP först när du avslutar lektionen.
            </Text>
          </>
        )}
      </ScrollView>

      {nyKlass && fid && <KlassModal forening={fid} onClose={() => setNyKlass(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.adminBg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 4 },
  kicker: { fontFamily: font.medium, fontSize: 12, color: colors.muted },
  hej: { fontFamily: font.bold, fontSize: 19, color: colors.ink },
  logout: { fontFamily: font.semibold, fontSize: 13, color: colors.muted },
  content: { paddingHorizontal: 18, paddingTop: 12 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  sectionTitle: { fontFamily: font.bold, fontSize: 16, color: colors.ink },
  addLink: { fontFamily: font.semibold, fontSize: 13, color: colors.primary },

  klassCard: { marginTop: 12, padding: 13, gap: 12 },
  klassMain: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  dot: { width: 10, height: 38, borderRadius: 5 },
  klassName: { fontFamily: font.semibold, fontSize: 15, color: colors.ink },
  klassMeta: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2, marginTop: 2 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.ink, borderRadius: radius.sm, paddingVertical: 11,
  },
  startBtnOpen: { backgroundColor: colors.green },
  startText: { fontFamily: font.semibold, fontSize: 13, color: colors.white },

  pending: { alignItems: 'center', paddingVertical: 26, paddingHorizontal: 22, marginTop: 12 },
  pendingTile: {
    width: 46, height: 46, borderRadius: 15, backgroundColor: colors.tintOrange2,
    alignItems: 'center', justifyContent: 'center',
  },
  pendingTitle: { fontFamily: font.bold, fontSize: 15, color: colors.ink, marginTop: 12 },
  pendingBody: {
    fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 5,
    textAlign: 'center', lineHeight: 18,
  },

  foot: { fontFamily: font.regular, fontSize: 11.5, color: colors.faint, textAlign: 'center', marginTop: 22, lineHeight: 16 },
});

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tappable } from '@/components/ui/Tappable';
import { StarPicker } from '@/features/larare/Stars';
import { StjarnaSheet } from '@/features/larare/StjarnaSheet';
import {
  useAvslutaLektion, useLektion, useLektionLista, useSattStjarnor, useSetNarvaro,
} from '@/hooks/useLarare';
import { NARVARO, categoryLabel, starXp } from '@/lib/stars';
import type { LektionRad, NarvaroStatus } from '@/lib/types';
import { colors, font, radius } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

const ORDNING: NarvaroStatus[] = ['har', 'sen', 'borta', 'anmald'];

/**
 * The lesson: the whole class on one screen, one sweep.
 *
 * Nothing here pays out until "Avsluta lektionen" — attendance, stars and
 * notifications are written in a single transaction at the end. That is what
 * lets the teacher tap freely without leaving a trail of undone awards.
 */
export default function LektionSkarm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeForening } = useAuth();
  const lektionId = id ?? null;

  const { data: lektion } = useLektion(lektionId);
  const { data: rader, isLoading } = useLektionLista(lektionId);
  const setNarvaro = useSetNarvaro();
  const sattStjarnor = useSattStjarnor();
  const avsluta = useAvslutaLektion();

  const [oppenRad, setOppenRad] = useState<LektionRad | null>(null);

  const summering = useMemo(() => {
    const rows = rader ?? [];
    return {
      narvarande: rows.filter((r) => r.status === 'har' || r.status === 'sen').length,
      stjarnor: rows.reduce((sum, r) => sum + (r.stars ?? 0), 0),
      xp: rows.reduce((sum, r) => sum + (r.stars ? starXp(activeForening?.star_xp, r.stars) : 0), 0),
    };
  }, [rader, activeForening?.star_xp]);

  const cycleStatus = (r: LektionRad) => {
    if (!lektionId) return;
    const next = ORDNING[(ORDNING.indexOf(r.status) + 1) % ORDNING.length];
    setNarvaro.mutate({ lektion: lektionId, elev: r.klass_elev_id, status: next });
  };

  const setStars = (r: LektionRad, stars: number) => {
    if (!lektionId) return;
    sattStjarnor.mutate({
      lektion: lektionId,
      elev: r.klass_elev_id,
      stars,
      kategori: r.kategori ?? 'hifz',
      note: r.note,
    });
  };

  const onAvsluta = () => {
    if (!lektionId) return;
    Alert.alert(
      'Avsluta lektionen',
      `${summering.narvarande} närvarande och ${summering.stjarnor}★ delas ut nu (+${summering.xp} XP totalt). Efter det går enskilda stjärnor bara att ångra en och en.`,
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Avsluta', onPress: () => avsluta.mutate(lektionId, { onSuccess: () => router.back() }) },
      ],
    );
  };

  const stangd = !!lektion?.closed_at;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.header}>
        <Tappable scale={0.88} hitSlop={8} onPress={() => router.back()} style={styles.iconBtn}>
          <Icon name="arrowL" size={18} color={colors.ink} />
        </Tappable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{lektion?.klass?.name ?? 'Lektion'}</Text>
          <Text style={styles.subtitle}>
            {lektion?.held_on ?? ''} · {summering.narvarande} närvarande · {summering.stjarnor}★
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {(rader ?? []).length === 0 && !isLoading ? (
          <EmptyState
            icon="user"
            title="Inga elever i klassen"
            body="Lägg till elever i klassen först, så dyker de upp här nästa gång du startar en lektion."
          />
        ) : (
          (rader ?? []).map((r) => {
            const n = NARVARO.find((x) => x.value === r.status) ?? NARVARO[0];
            return (
              <View key={r.klass_elev_id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={[styles.avatar, { backgroundColor: r.avatar_color }]}>
                    <Text style={styles.avatarText}>{r.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                  <Tappable
                    scale={0.9}
                    style={[styles.statusPill, { backgroundColor: n.color }]}
                    onPress={() => cycleStatus(r)}
                    disabled={stangd}
                    accessibilityRole="button"
                    accessibilityLabel={`Närvaro: ${n.label}. Tryck för att ändra.`}
                  >
                    <Text style={styles.statusText}>{n.label}</Text>
                  </Tappable>
                </View>

                <View style={styles.cardBottom}>
                  <StarPicker
                    value={r.stars ?? 0}
                    onChange={(s) => setStars(r, s)}
                    size={25}
                    disabled={stangd}
                  />
                  <Tappable
                    scale={0.94}
                    style={styles.catChip}
                    onPress={() => setOppenRad(r)}
                    disabled={stangd}
                  >
                    <Text style={styles.catText} numberOfLines={1}>
                      {r.stars ? categoryLabel(r.kategori) : 'Kategori'}
                    </Text>
                    <Icon name="chev" size={13} color={colors.muted} />
                  </Tappable>
                </View>

                {!!r.note && <Text style={styles.note} numberOfLines={2}>{r.note}</Text>}
              </View>
            );
          })
        )}
      </ScrollView>

      {!stangd && (rader ?? []).length > 0 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Tappable
            scale={0.97}
            style={styles.avslutaBtn}
            onPress={onAvsluta}
            disabled={avsluta.isPending}
          >
            <Icon name="check" size={17} color={colors.white} />
            <Text style={styles.avslutaText}>
              Avsluta lektionen · {summering.stjarnor}★
            </Text>
          </Tappable>
          <Text style={styles.footerHint}>XP delas ut först nu — ändra fritt tills dess.</Text>
        </View>
      )}

      {oppenRad && lektionId && (
        <StjarnaSheet lektion={lektionId} rad={oppenRad} onClose={() => setOppenRad(null)} />
      )}
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

  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: 12, marginTop: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.bold, fontSize: 14, color: colors.white },
  name: { fontFamily: font.semibold, fontSize: 14, color: colors.ink, flex: 1 },
  statusPill: { borderRadius: 999, paddingVertical: 6, paddingHorizontal: 13, minWidth: 62, alignItems: 'center' },
  statusText: { fontFamily: font.semibold, fontSize: 12, color: colors.white },

  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.adminBg, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 11,
  },
  catText: { fontFamily: font.semibold, fontSize: 12, color: colors.muted, maxWidth: 110 },
  note: { fontFamily: font.regular, fontSize: 12, color: colors.muted2, marginTop: 9, lineHeight: 16 },

  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 18, paddingTop: 12,
    backgroundColor: colors.adminBg, borderTopWidth: 1, borderTopColor: colors.navBorder,
  },
  avslutaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.green, borderRadius: radius.tile, paddingVertical: 15,
  },
  avslutaText: { fontFamily: font.semibold, fontSize: 15, color: colors.white },
  footerHint: { fontFamily: font.regular, fontSize: 11, color: colors.faint, textAlign: 'center', marginTop: 7 },
});

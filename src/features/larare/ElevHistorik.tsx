import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert } from '@/lib/alert';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/ui/TextField';
import { Tappable } from '@/components/ui/Tappable';
import { StarPicker, StarRow } from '@/features/larare/Stars';
import { useAngraStjarna, useElevStjarnor, useGeStjarna, useRemoveKlassElev } from '@/hooks/useLarare';
import { STAR_CATEGORIES, categoryLabel, starXp } from '@/lib/stars';
import type { KlassElev, StarCategory } from '@/lib/types';
import { colors, font, radius, relativeDate } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

/**
 * One student, seen by their teacher: the whole star history plus a way to
 * award a star between lessons (homework handed in, for instance).
 *
 * A star given here pays out immediately — there is no lesson to close.
 */
export function ElevHistorik({ elev, onClose }: { elev: KlassElev; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { activeForening } = useAuth();
  const { data: historik } = useElevStjarnor(true, {
    userId: elev.student_user_id,
    childId: elev.child_id,
  });
  const ge = useGeStjarna();
  const angra = useAngraStjarna();
  const remove = useRemoveKlassElev();

  const [stars, setStars] = useState(0);
  const [kategori, setKategori] = useState<StarCategory>('laxa');
  const [note, setNote] = useState('');

  const xp = stars > 0 ? starXp(activeForening?.star_xp, stars) : 0;

  const onGe = () => {
    if (stars < 1) return;
    ge.mutate(
      { elev: elev.id, stars, kategori, note: note.trim() || null },
      { onSuccess: () => { setStars(0); setNote(''); } },
    );
  };

  const onAngra = (id: string) => {
    Alert.alert('Ångra stjärnan', 'XP:t dras tillbaka. Raden ligger kvar i historiken som ångrad.', [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Ångra', style: 'destructive', onPress: () => angra.mutate(id) },
    ]);
  };

  const onRemove = () => {
    Alert.alert('Ta bort ur klassen', `Ta bort ${elev.name} ur klassen? Stjärnhistoriken finns kvar.`, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Ta bort', style: 'destructive', onPress: () => remove.mutate(elev.id, { onSuccess: onClose }) },
    ]);
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.head}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.cancel}>Klar</Text>
            </Pressable>
            <Text style={styles.title} numberOfLines={1}>{elev.name}</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >
            <View style={styles.stats}>
              <Stat label="Nivå" value={String(elev.level)} />
              <Stat label="Denna vecka" value={`${elev.stjarnor_veckan}★`} />
              <Stat label="Totalt" value={`${elev.stjarnor_totalt}★`} />
            </View>

            <Text style={styles.sectionTitle}>Ge en stjärna</Text>
            <View style={styles.geCard}>
              <StarPicker value={stars} onChange={setStars} />
              <View style={styles.chips}>
                {STAR_CATEGORIES.map((c) => {
                  const on = kategori === c.value;
                  return (
                    <Pressable
                      key={c.value}
                      onPress={() => setKategori(c.value)}
                      style={[styles.chip, { backgroundColor: on ? colors.ink : c.tint }]}
                    >
                      <Text style={[styles.chipText, { color: on ? colors.white : colors.ink }]}>{c.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextField
                placeholder="Kommentar till eleven (valfritt)"
                value={note}
                onChangeText={setNote}
                style={{ marginTop: 10 }}
              />
              <Tappable
                scale={0.96}
                style={[styles.geBtn, stars < 1 && { opacity: 0.4 }]}
                disabled={stars < 1 || ge.isPending}
                onPress={onGe}
              >
                <Icon name="star" size={15} color={colors.white} />
                <Text style={styles.geText}>{stars > 0 ? `Ge ${stars}★ · +${xp} XP` : 'Välj antal stjärnor'}</Text>
              </Tappable>
            </View>

            <Text style={styles.sectionTitle}>Historik</Text>
            {(historik ?? []).length === 0 ? (
              <Text style={styles.empty}>Inga stjärnor utdelade än.</Text>
            ) : (
              (historik ?? []).map((s) => (
                <View key={s.id} style={[styles.histRow, s.angrad && { opacity: 0.45 }]}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.histTop}>
                      <StarRow value={s.stars} />
                      <Text style={styles.histCat}>{categoryLabel(s.kategori)}</Text>
                    </View>
                    <Text style={styles.histMeta}>
                      {relativeDate(s.created_at)} · {s.klass} · {s.angrad ? 'ångrad' : `+${s.xp} XP`}
                    </Text>
                    {!!s.note && <Text style={styles.histNote}>{s.note}</Text>}
                  </View>
                  {!s.angrad && (
                    <Pressable onPress={() => onAngra(s.id)} hitSlop={8}>
                      <Text style={styles.undo}>Ångra</Text>
                    </Pressable>
                  )}
                </View>
              ))
            )}

            <Pressable onPress={onRemove} style={styles.removeBtn} disabled={remove.isPending}>
              <Text style={styles.removeText}>Ta bort ur klassen</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.adminBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, height: '90%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10 },
  cancel: { fontFamily: font.semibold, fontSize: 14, color: colors.primary, width: 40 },
  title: { fontFamily: font.bold, fontSize: 15, color: colors.ink, flex: 1, textAlign: 'center' },
  body: { paddingHorizontal: 18, paddingBottom: 20 },

  stats: { flexDirection: 'row', gap: 9 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  statValue: { fontFamily: font.bold, fontSize: 17, color: colors.ink },
  statLabel: { fontFamily: font.regular, fontSize: 11, color: colors.muted2, marginTop: 1 },

  sectionTitle: { fontFamily: font.bold, fontSize: 14.5, color: colors.ink, marginTop: 20, marginBottom: 9 },
  geCard: { backgroundColor: colors.white, borderRadius: radius.md, padding: 14, alignItems: 'stretch' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: 999 },
  chipText: { fontFamily: font.semibold, fontSize: 12 },
  geBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.ink, borderRadius: radius.sm, paddingVertical: 12, marginTop: 12,
  },
  geText: { fontFamily: font.semibold, fontSize: 13, color: colors.white },

  empty: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2 },
  histRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 8,
    backgroundColor: colors.white, borderRadius: radius.md, padding: 12,
  },
  histTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  histCat: { fontFamily: font.semibold, fontSize: 12.5, color: colors.ink },
  histMeta: { fontFamily: font.regular, fontSize: 11, color: colors.muted2, marginTop: 3 },
  histNote: { fontFamily: font.regular, fontSize: 12, color: colors.ink, marginTop: 4, lineHeight: 16 },
  undo: { fontFamily: font.semibold, fontSize: 12, color: colors.pink },

  removeBtn: { marginTop: 22, paddingVertical: 13, borderRadius: 13, borderWidth: 1.5, borderColor: colors.pink, alignItems: 'center' },
  removeText: { fontFamily: font.semibold, fontSize: 13.5, color: colors.pink },
});

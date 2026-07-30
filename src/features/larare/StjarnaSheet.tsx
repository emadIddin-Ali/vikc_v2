import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextField } from '@/components/ui/TextField';
import { Tappable } from '@/components/ui/Tappable';
import { StarPicker } from '@/features/larare/Stars';
import { useSattStjarnor } from '@/hooks/useLarare';
import { STAR_CATEGORIES, starXp } from '@/lib/stars';
import type { LektionRad, StarCategory } from '@/lib/types';
import { colors, font, radius } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

/**
 * The detailed grade for one student on an open lesson: stars, what it was
 * for, and a note the student and their parent will read. The row on the
 * lesson screen stays the fast path — this is for when the teacher has
 * something to say.
 */
export function StjarnaSheet({
  lektion,
  rad,
  onClose,
}: {
  lektion: string;
  rad: LektionRad;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { activeForening } = useAuth();
  const satt = useSattStjarnor();

  const [stars, setStars] = useState(rad.stars ?? 0);
  const [kategori, setKategori] = useState<StarCategory>(rad.kategori ?? 'hifz');
  const [note, setNote] = useState(rad.note ?? '');

  const xp = stars > 0 ? starXp(activeForening?.star_xp, stars) : 0;

  const onSave = () => {
    satt.mutate(
      { lektion, elev: rad.klass_elev_id, stars, kategori, note: note.trim() || null },
      { onSuccess: onClose },
    );
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.head}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.cancel}>Avbryt</Text>
            </Pressable>
            <Text style={styles.title} numberOfLines={1}>{rad.name}</Text>
            <Pressable onPress={onSave} hitSlop={8} disabled={satt.isPending}>
              <Text style={styles.save}>Spara</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >
            <View style={styles.starWrap}>
              <StarPicker value={stars} onChange={setStars} size={34} />
              <Text style={styles.xp}>{stars > 0 ? `+${xp} XP när lektionen avslutas` : 'Ingen stjärna satt'}</Text>
            </View>

            <Text style={styles.label}>Vad gällde det?</Text>
            <View style={styles.chips}>
              {STAR_CATEGORIES.map((c) => {
                const on = kategori === c.value;
                return (
                  <Tappable
                    key={c.value}
                    scale={0.94}
                    style={[styles.chip, { backgroundColor: on ? colors.ink : c.tint }]}
                    onPress={() => setKategori(c.value)}
                  >
                    <Text style={[styles.chipText, { color: on ? colors.white : colors.ink }]}>{c.label}</Text>
                  </Tappable>
                );
              })}
            </View>

            <Text style={styles.label}>Kommentar</Text>
            <TextField
              placeholder="T.ex. Al-Mulk 1–10, felfritt"
              value={note}
              onChangeText={setNote}
              multiline
              style={styles.note}
            />
            <Text style={styles.hint}>Eleven och föräldern ser kommentaren i sin stjärnhistorik.</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.adminBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, maxHeight: '85%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10 },
  cancel: { fontFamily: font.medium, fontSize: 14, color: colors.muted },
  title: { fontFamily: font.bold, fontSize: 15, color: colors.ink, flex: 1, textAlign: 'center' },
  save: { fontFamily: font.bold, fontSize: 14, color: colors.primary },
  body: { paddingHorizontal: 18, paddingBottom: 12 },
  starWrap: { alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, paddingVertical: 18, marginTop: 4 },
  xp: { fontFamily: font.medium, fontSize: 12, color: colors.muted, marginTop: 10 },
  label: { fontFamily: font.semibold, fontSize: 13, color: colors.ink, marginTop: 20, marginBottom: 9 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingVertical: 9, paddingHorizontal: 13, borderRadius: 999 },
  chipText: { fontFamily: font.semibold, fontSize: 12.5 },
  note: { minHeight: 84, textAlignVertical: 'top', paddingTop: 12 },
  hint: { fontFamily: font.regular, fontSize: 11.5, color: colors.faint, marginTop: 8 },
});

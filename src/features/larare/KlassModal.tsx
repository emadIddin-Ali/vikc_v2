import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextField } from '@/components/ui/TextField';
import { useArchiveKlass, useCreateKlass, useUpdateKlass } from '@/hooks/useLarare';
import type { LarareKlass } from '@/lib/types';
import { colors, font } from '@/theme/tokens';

const DAGAR = ['Sön', 'Mån', 'Tis', 'Ons', 'Tors', 'Fre', 'Lör'];
const FARGER = ['#6c4cf1', '#22c55e', '#ff7a4d', '#2b6bff', '#ff4d8d', '#caa500'];

/** Create or edit a class. Same sheet either way — `klass` decides which. */
export function KlassModal({
  forening,
  klass,
  onClose,
}: {
  forening: string;
  klass?: LarareKlass;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const create = useCreateKlass();
  const update = useUpdateKlass();
  const archive = useArchiveKlass();

  const [name, setName] = useState(klass?.name ?? '');
  const [desc, setDesc] = useState(klass?.description ?? '');
  const [weekday, setWeekday] = useState<number | null>(klass?.weekday ?? null);
  const [timeText, setTimeText] = useState(klass?.time_text ?? '');
  const [color, setColor] = useState(klass?.color ?? FARGER[0]);

  const busy = create.isPending || update.isPending;

  const onSave = () => {
    if (!name.trim()) return;
    const vars = {
      name: name.trim(),
      description: desc.trim() || null,
      weekday,
      timeText: timeText.trim() || null,
      color,
    };
    if (klass) update.mutate({ ...vars, klass: klass.id }, { onSuccess: onClose });
    else create.mutate({ ...vars, forening }, { onSuccess: onClose });
  };

  const onArchive = () => {
    if (!klass) return;
    Alert.alert(
      'Arkivera klassen',
      `Arkivera "${klass.name}"? Elevernas stjärnhistorik finns kvar, men klassen försvinner ur listan.`,
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Arkivera', style: 'destructive', onPress: () => archive.mutate(klass.id, { onSuccess: onClose }) },
      ],
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
            <Text style={styles.title}>{klass ? 'Redigera klass' : 'Ny klass'}</Text>
            <Pressable onPress={onSave} hitSlop={8} disabled={busy || !name.trim()}>
              <Text style={[styles.save, (busy || !name.trim()) && { opacity: 0.4 }]}>Spara</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >
            <TextField placeholder="Namn, t.ex. Halaqa 2" value={name} onChangeText={setName} style={styles.input} />
            <TextField placeholder="Nivå eller juz (valfritt)" value={desc} onChangeText={setDesc} style={styles.input} />

            <Text style={styles.label}>Dag</Text>
            <View style={styles.chips}>
              <Chip label="Ingen" on={weekday === null} onPress={() => setWeekday(null)} />
              {DAGAR.map((d, i) => (
                <Chip key={d} label={d} on={weekday === i} onPress={() => setWeekday(i)} />
              ))}
            </View>

            <TextField
              placeholder="Tid, t.ex. 10:00–11:30"
              value={timeText}
              onChangeText={setTimeText}
              style={styles.input}
            />

            <Text style={styles.label}>Färg</Text>
            <View style={styles.chips}>
              {FARGER.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: color === c }}
                />
              ))}
            </View>

            {klass?.join_code ? (
              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>Klasskod</Text>
                <Text style={styles.code}>{klass.join_code}</Text>
                <Text style={styles.codeHint}>
                  En elev eller förälder som redan är med i föreningen kan gå med i klassen själv med den här koden.
                </Text>
              </View>
            ) : null}

            {klass ? (
              <Pressable onPress={onArchive} style={styles.deleteBtn} disabled={archive.isPending}>
                <Text style={styles.deleteText}>Arkivera klass</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: on ? colors.ink : colors.white }]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
    >
      <Text style={[styles.chipText, { color: on ? colors.white : colors.muted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.adminBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, maxHeight: '90%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10 },
  cancel: { fontFamily: font.medium, fontSize: 14, color: colors.muted },
  title: { fontFamily: font.bold, fontSize: 15, color: colors.ink },
  save: { fontFamily: font.bold, fontSize: 14, color: colors.primary },
  body: { paddingHorizontal: 18, paddingBottom: 8 },
  input: { marginTop: 10 },
  label: { fontFamily: font.medium, fontSize: 12.5, color: colors.ink, marginTop: 16, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: 999 },
  chipText: { fontFamily: font.semibold, fontSize: 12.5 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: 'transparent' },
  swatchOn: { borderColor: colors.ink },
  codeBox: { marginTop: 20, backgroundColor: colors.white, borderRadius: 14, padding: 14 },
  codeLabel: { fontFamily: font.medium, fontSize: 11.5, color: colors.muted },
  code: { fontFamily: font.bold, fontSize: 22, color: colors.ink, letterSpacing: 2, marginTop: 2 },
  codeHint: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2, marginTop: 6, lineHeight: 16 },
  deleteBtn: { marginTop: 22, paddingVertical: 13, borderRadius: 13, borderWidth: 1.5, borderColor: colors.pink, alignItems: 'center' },
  deleteText: { fontFamily: font.semibold, fontSize: 13.5, color: colors.pink },
});

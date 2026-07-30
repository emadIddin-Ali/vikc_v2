import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextField } from '@/components/ui/TextField';
import { useAddChild, useUpdateChild } from '@/hooks/useParent';
import type { Child } from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { colors, font } from '@/theme/tokens';
import { toast } from '@/store/toast';

const COLORS = ['#6c4cf1', '#22c55e', '#ff7a4d', '#ff4d8d', '#0ea5e9', '#ffd23f'];

/** Add a new child, or edit an existing one when `child` is passed. */
export function AddChildModal({ forening, child, onClose }: { forening: string; child?: Child; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { memberships } = useAuth();
  const add = useAddChild();
  const update = useUpdateChild();
  const editing = !!child;

  // Does this child's förening require a personnummer?
  const requirePnr = memberships.find((m) => m.forening_id === forening)?.forening?.require_personnummer ?? false;

  const [name, setName] = useState(child?.display_name ?? '');
  const [year, setYear] = useState(child?.birth_year != null ? String(child.birth_year) : '');
  const [personnummer, setPersonnummer] = useState(child?.personnummer ?? '');
  const [color, setColor] = useState(child?.avatar_color ?? COLORS[0]);

  const busy = add.isPending || update.isPending;

  const onSave = () => {
    if (!name.trim()) return toast('Skriv ett namn');
    if (requirePnr && !personnummer.trim()) return toast('Föreningen kräver personnummer');
    const birthYear = year.trim() ? parseInt(year) || null : null;
    const pnr = personnummer.trim() || null;
    if (editing) {
      update.mutate({ child: child!.id, name, birthYear, color, personnummer: pnr }, { onSuccess: onClose });
    } else {
      add.mutate({ forening, name, birthYear, color, personnummer: pnr }, { onSuccess: onClose });
    }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.head}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.cancel}>Avbryt</Text>
            </Pressable>
            <Text style={styles.title}>{editing ? 'Redigera barn' : 'Lägg till barn'}</Text>
            <Pressable onPress={onSave} hitSlop={8} disabled={busy}>
              <Text style={styles.save}>Spara</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Barnets namn</Text>
            <TextField placeholder="T.ex. Liam" value={name} onChangeText={setName} autoCapitalize="words" />

            <Text style={styles.label}>Födelseår (valfritt)</Text>
            <TextField placeholder="T.ex. 2016" value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} />

            <Text style={styles.label}>{requirePnr ? 'Personnummer' : 'Personnummer (valfritt)'}</Text>
            <TextField placeholder="ÅÅÅÅMMDD-XXXX" value={personnummer} onChangeText={setPersonnummer} keyboardType="number-pad" />

            <Text style={styles.label}>Färg</Text>
            <View style={styles.colorRow}>
              {COLORS.map((c) => (
                <Pressable key={c} onPress={() => setColor(c)} style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchOn]} />
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  label: { fontFamily: font.semibold, fontSize: 12.5, color: colors.ink, marginTop: 14, marginBottom: 8 },
  colorRow: { flexDirection: 'row', gap: 12 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, borderColor: 'transparent' },
  swatchOn: { borderColor: colors.ink },
});

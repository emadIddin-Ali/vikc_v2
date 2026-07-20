import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TextField } from '@/components/ui/TextField';
import { useDeleteMission, useUpdateMission } from '@/hooks/useLedare';
import type { Mission } from '@/lib/types';
import { colors, font } from '@/theme/tokens';

export function EditMission({ mission, onClose }: { mission: Mission; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const update = useUpdateMission();
  const del = useDeleteMission();

  const [title, setTitle] = useState(mission.title);
  const [desc, setDesc] = useState(mission.description ?? '');
  const [goal, setGoal] = useState(String(mission.goal));
  const [xp, setXp] = useState(String(mission.xp));
  const [autoVisit, setAutoVisit] = useState(mission.auto_visit);

  const onSave = () => {
    update.mutate(
      {
        id: mission.id,
        patch: {
          title: title.trim() || mission.title,
          description: desc.trim(),
          goal: Math.max(parseInt(goal) || 1, 1),
          xp: parseInt(xp) || mission.xp,
          auto_visit: autoVisit,
        },
      },
      { onSuccess: onClose },
    );
  };

  const onDelete = () => {
    Alert.alert('Ta bort uppdrag', `Ta bort "${mission.title}"? Detta går inte att ångra.`, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Ta bort', style: 'destructive', onPress: () => del.mutate(mission.id, { onSuccess: onClose }) },
    ]);
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.head}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.cancel}>Avbryt</Text>
            </Pressable>
            <Text style={styles.title}>Redigera uppdrag</Text>
            <Pressable onPress={onSave} hitSlop={8} disabled={update.isPending}>
              <Text style={styles.save}>Spara</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <TextField placeholder="Namn" value={title} onChangeText={setTitle} style={styles.input} />
            <TextField placeholder="Beskrivning" value={desc} onChangeText={setDesc} style={styles.input} />
            <View style={styles.row}>
              <TextField placeholder="Mål" value={goal} onChangeText={setGoal} keyboardType="number-pad" style={[styles.input, { flex: 1 }]} />
              <TextField placeholder="XP" value={xp} onChangeText={setXp} keyboardType="number-pad" style={[styles.input, { width: 90 }]} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Räkna upp vid incheckning</Text>
              <Switch value={autoVisit} onValueChange={setAutoVisit} trackColor={{ true: colors.primary, false: '#d9d2ec' }} thumbColor={colors.white} />
            </View>

            <Pressable onPress={onDelete} style={styles.deleteBtn} disabled={del.isPending}>
              <Text style={styles.deleteText}>Ta bort uppdrag</Text>
            </Pressable>
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
  input: { marginTop: 10 },
  row: { flexDirection: 'row', gap: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  switchLabel: { fontFamily: font.medium, fontSize: 13, color: colors.ink },
  deleteBtn: { marginTop: 22, paddingVertical: 13, borderRadius: 13, borderWidth: 1.5, borderColor: colors.pink, alignItems: 'center' },
  deleteText: { fontFamily: font.semibold, fontSize: 13.5, color: colors.pink },
});

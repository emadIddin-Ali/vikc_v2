import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { Stjarnkort } from '@/features/larare/Stjarnkort';
import { useChildCheckins, useRemoveChild } from '@/hooks/useParent';
import type { Child } from '@/lib/types';
import { colors, font, levelName, relativeDate } from '@/theme/tokens';

export function ChildDetailModal({
  child, onClose, onEdit, onCheckIn, onShop,
}: {
  child: Child;
  onClose: () => void;
  onEdit: () => void;
  onCheckIn: () => void;
  onShop: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { data: history } = useChildCheckins(child.id);
  const remove = useRemoveChild();

  const onRemove = () => {
    Alert.alert('Ta bort barn', `Ta bort "${child.display_name}"? All historik försvinner. Detta går inte att ångra.`, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Ta bort', style: 'destructive', onPress: () => remove.mutate(child.id, { onSuccess: onClose }) },
    ]);
  };

  const stats = [
    { v: String(child.points), label: 'poäng' },
    { v: String(child.visits), label: 'besök' },
    { v: String(child.week_streak), label: 'veckor i rad' },
  ];

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.head}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.cancel}>Stäng</Text>
            </Pressable>
            <Text style={styles.title}>{child.display_name}</Text>
            <Pressable onPress={onEdit} hitSlop={8}>
              <Text style={styles.save}>Redigera</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={[styles.hero, { backgroundColor: child.avatar_color }]}>
              <Text style={styles.heroLevel}>NIVÅ {child.level} · {levelName(child.level)}</Text>
              <Text style={styles.heroName}>{child.display_name}</Text>
            </View>

            <View style={styles.statRow}>
              {stats.map((s) => (
                <View key={s.label} style={styles.stat}>
                  <Text style={styles.statV}>{s.v}</Text>
                  <Text style={styles.statL}>{s.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.actions}>
              <Pressable style={[styles.checkinBtn, { flex: 1 }]} onPress={onCheckIn}>
                <Icon name="camera" size={16} color={colors.white} />
                <Text style={styles.checkinText}>Checka in</Text>
              </Pressable>
              {/* Barnets poäng var en återvändsgränd innan det gick att handla för dem. */}
              <Pressable style={[styles.shopBtn, { flex: 1 }]} onPress={onShop}>
                <Icon name="bag" size={16} color={colors.white} />
                <Text style={styles.checkinText}>Butik</Text>
              </Pressable>
            </View>

            {/* Klasser och stjärnor — osynligt om barnet inte går i någon klass */}
            <Stjarnkort childId={child.id} title="Klass och stjärnor" />

            <Text style={styles.section}>Senaste besök</Text>
            {(history ?? []).length === 0 ? (
              <Text style={styles.empty}>Inga incheckningar än.</Text>
            ) : (
              (history ?? []).map((h) => (
                <View key={h.id} style={styles.visitRow}>
                  <View style={styles.visitTile}>
                    <Icon name="pin" size={15} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.visitTitle}>{h.title ?? 'Incheckning'}</Text>
                    <Text style={styles.visitDate}>{relativeDate(h.created_at)}</Text>
                  </View>
                  <Text style={styles.visitPts}>+{h.awarded_points}</Text>
                </View>
              ))
            )}

            <Pressable onPress={onRemove} style={styles.deleteBtn} disabled={remove.isPending}>
              <Text style={styles.deleteText}>Ta bort barn</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.adminBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, maxHeight: '92%' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10 },
  cancel: { fontFamily: font.medium, fontSize: 14, color: colors.muted },
  title: { fontFamily: font.bold, fontSize: 15, color: colors.ink },
  save: { fontFamily: font.bold, fontSize: 14, color: colors.primary },
  body: { paddingHorizontal: 18, paddingBottom: 8 },

  hero: { borderRadius: 20, padding: 18, marginTop: 4 },
  heroLevel: { fontFamily: font.medium, fontSize: 11, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.6 },
  heroName: { fontFamily: font.bold, fontSize: 24, color: colors.white, marginTop: 3 },

  statRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  stat: { flex: 1, backgroundColor: colors.white, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  statV: { fontFamily: font.bold, fontSize: 19, color: colors.primary },
  statL: { fontFamily: font.regular, fontSize: 10.5, color: colors.muted2, marginTop: 2 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  checkinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.green, borderRadius: 13, paddingVertical: 13 },
  shopBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 13, paddingVertical: 13 },
  checkinText: { fontFamily: font.semibold, fontSize: 14, color: colors.white },

  section: { fontFamily: font.semibold, fontSize: 14, color: colors.ink, marginTop: 20, marginBottom: 4 },
  empty: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 8 },
  visitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 11 },
  visitTile: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.tintPurple2, alignItems: 'center', justifyContent: 'center' },
  visitTitle: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  visitDate: { fontFamily: font.regular, fontSize: 11, color: colors.muted2 },
  visitPts: { fontFamily: font.bold, fontSize: 12.5, color: colors.primary },

  deleteBtn: { marginTop: 24, paddingVertical: 13, borderRadius: 13, borderWidth: 1.5, borderColor: colors.pink, alignItems: 'center' },
  deleteText: { fontFamily: font.semibold, fontSize: 13.5, color: colors.pink },
});

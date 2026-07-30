import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateTimeField } from '@/components/DateTimeField';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/ui/TextField';
import { useDeleteActivity, useUpdateActivity } from '@/hooks/useLedare';
import { fmtDateTime } from '@/lib/date';
import type { Activity } from '@/lib/types';
import { THEMES, colors, font } from '@/theme/tokens';

const THEME_IDS = Object.keys(THEMES);

export function EditActivity({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const update = useUpdateActivity();
  const del = useDeleteActivity();

  const [title, setTitle] = useState(activity.title);
  const [points, setPoints] = useState(String(activity.points));
  const [theme, setTheme] = useState(activity.theme);
  const [startsAt, setStartsAt] = useState<Date | null>(activity.starts_at ? new Date(activity.starts_at) : null);
  const [durationMin, setDurationMin] = useState(activity.duration_min != null ? String(activity.duration_min) : '');
  const [dailyLimit, setDailyLimit] = useState(String(activity.daily_limit));
  const [radiusM, setRadiusM] = useState(activity.radius_m != null ? String(activity.radius_m) : '');
  const [requiresPhoto, setRequiresPhoto] = useState(activity.requires_photo);
  const [requiresCheckout, setRequiresCheckout] = useState(activity.requires_checkout);

  const onSave = () => {
    const patch: Record<string, unknown> = {
      title: title.trim() || activity.title,
      points: parseInt(points) || activity.points,
      theme,
      daily_limit: Math.max(parseInt(dailyLimit) || 1, 1),
      radius_m: radiusM ? parseInt(radiusM) : null,
      requires_photo: activity.checkin_mode === 'open' ? requiresPhoto : false,
      requires_checkout: requiresCheckout,
    };
    if (!activity.continuous) {
      patch.starts_at = startsAt ? startsAt.toISOString() : null;
      patch.when_text = startsAt ? fmtDateTime(startsAt) : activity.when_text;
      patch.duration_min = durationMin ? parseInt(durationMin) : null;
    }
    update.mutate({ id: activity.id, patch }, { onSuccess: onClose });
  };

  const onDelete = () => {
    Alert.alert('Ta bort aktivitet', `Ta bort "${activity.title}"? Detta går inte att ångra.`, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Ta bort', style: 'destructive', onPress: () => del.mutate(activity.id, { onSuccess: onClose }) },
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
            <Text style={styles.title}>Redigera aktivitet</Text>
            <Pressable onPress={onSave} hitSlop={8} disabled={update.isPending}>
              <Text style={styles.save}>Spara</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets>
            <TextField placeholder="Namn" value={title} onChangeText={setTitle} style={styles.input} />
            <TextField placeholder="Poäng" value={points} onChangeText={setPoints} keyboardType="number-pad" style={styles.input} />

            {!activity.continuous && (
              <>
                <Text style={styles.label}>Tid</Text>
                <DateTimeField value={startsAt} onChange={setStartsAt} />
                <TextField placeholder="Incheckningstid (min)" value={durationMin} onChangeText={setDurationMin} keyboardType="number-pad" style={styles.input} />
              </>
            )}

            <TextField placeholder="Max incheckningar per dag" value={dailyLimit} onChangeText={setDailyLimit} keyboardType="number-pad" style={styles.input} />
            <TextField placeholder="Radie i meter (incheckningsplats)" value={radiusM} onChangeText={setRadiusM} keyboardType="number-pad" style={styles.input} />

            {activity.checkin_mode === 'open' && (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Kräv foto på plats</Text>
                <Switch value={requiresPhoto} onValueChange={setRequiresPhoto} trackColor={{ true: colors.primary, false: '#d9d2ec' }} thumbColor={colors.white} />
              </View>
            )}

            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.switchLabel}>Kräv utcheckning</Text>
                <Text style={styles.switchHint}>Poängen ges först vid utcheckning.</Text>
              </View>
              <Switch value={requiresCheckout} onValueChange={setRequiresCheckout} trackColor={{ true: colors.primary, false: '#d9d2ec' }} thumbColor={colors.white} />
            </View>

            <Text style={styles.label}>Tema</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themes}>
              {THEME_IDS.map((id) => {
                const t = THEMES[id];
                const sel = theme === id;
                return (
                  <Pressable key={id} onPress={() => setTheme(id)} style={styles.themeCol}>
                    <LinearGradient colors={t.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.swatch, { borderColor: sel ? colors.ink : 'transparent' }]}>
                      {sel && (
                        <View style={styles.swatchCheck}>
                          <Icon name="check" size={12} color={colors.ink} />
                        </View>
                      )}
                    </LinearGradient>
                    <Text style={styles.themeName}>{t.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable onPress={onDelete} style={styles.deleteBtn} disabled={del.isPending}>
              <Text style={styles.deleteText}>Ta bort aktivitet</Text>
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
  label: { fontFamily: font.semibold, fontSize: 12.5, color: colors.ink, marginTop: 14, marginBottom: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  switchLabel: { fontFamily: font.medium, fontSize: 13, color: colors.ink },
  switchHint: { fontFamily: font.regular, fontSize: 11, color: colors.muted2, marginTop: 2, lineHeight: 15 },
  themes: { gap: 9, paddingVertical: 4 },
  themeCol: { width: 64, alignItems: 'center' },
  swatch: { width: '100%', height: 52, borderRadius: 13, borderWidth: 2.5, alignItems: 'flex-start' },
  swatchCheck: { margin: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  themeName: { fontFamily: font.regular, fontSize: 10, color: '#7c6da0', marginTop: 4 },
  deleteBtn: { marginTop: 22, paddingVertical: 13, borderRadius: 13, borderWidth: 1.5, borderColor: colors.pink, alignItems: 'center' },
  deleteText: { fontFamily: font.semibold, fontSize: 13.5, color: colors.pink },
});

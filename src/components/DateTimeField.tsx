import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { fmtDateTime } from '@/lib/date';
import { colors, font } from '@/theme/tokens';

function roundToNextHour(d: Date) {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  x.setHours(x.getHours() + 1);
  return x;
}

/**
 * Cross-platform date+time picker.
 * iOS: a bottom-sheet spinner with a "Klar" button (avoids the invisible inline picker).
 * Android: the native date dialog, then the time dialog.
 */
export function DateTimeField({ value, onChange }: { value: Date | null; onChange: (d: Date) => void }) {
  const insets = useSafeAreaInsets();
  const [iosOpen, setIosOpen] = useState(false);
  const [temp, setTemp] = useState<Date>(value ?? roundToNextHour(new Date()));
  const [androidStep, setAndroidStep] = useState<'date' | 'time' | null>(null);
  const [androidDraft, setAndroidDraft] = useState<Date>(value ?? roundToNextHour(new Date()));

  const open = () => {
    const start = value ?? roundToNextHour(new Date());
    if (Platform.OS === 'ios') {
      setTemp(start);
      setIosOpen(true);
    } else {
      setAndroidDraft(start);
      setAndroidStep('date');
    }
  };

  const onAndroidChange = (e: DateTimePickerEvent, selected?: Date) => {
    if (e.type === 'dismissed') {
      setAndroidStep(null);
      return;
    }
    const val = selected ?? androidDraft;
    if (androidStep === 'date') {
      const d = new Date(val.getFullYear(), val.getMonth(), val.getDate(), androidDraft.getHours(), androidDraft.getMinutes());
      setAndroidDraft(d);
      setAndroidStep('time');
    } else {
      const final = new Date(androidDraft.getFullYear(), androidDraft.getMonth(), androidDraft.getDate(), val.getHours(), val.getMinutes());
      setAndroidStep(null);
      onChange(final);
    }
  };

  return (
    <>
      <Pressable onPress={open} style={styles.btn}>
        <Icon name="calendar" size={18} color={colors.primary} />
        <Text style={styles.text}>{value ? fmtDateTime(value) : 'Välj datum & tid'}</Text>
      </Pressable>

      {Platform.OS === 'ios' && (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <View style={styles.backdrop}>
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
              <View style={styles.sheetBtns}>
                <Pressable onPress={() => setIosOpen(false)} hitSlop={8}>
                  <Text style={styles.cancel}>Avbryt</Text>
                </Pressable>
                <Text style={styles.sheetTitle}>Välj tid</Text>
                <Pressable onPress={() => { onChange(temp); setIosOpen(false); }} hitSlop={8}>
                  <Text style={styles.done}>Klar</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={temp}
                mode="datetime"
                display="spinner"
                themeVariant="light"
                textColor={colors.ink}
                onChange={(_e, d) => d && setTemp(d)}
                style={styles.picker}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'android' && androidStep && (
        <DateTimePicker value={androidDraft} mode={androidStep} onChange={onAndroidChange} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1.5, borderColor: colors.inputBorder, justifyContent: 'center',
  },
  text: { fontFamily: font.semibold, fontSize: 13, color: colors.primary },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 16 },
  sheetBtns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 6 },
  sheetTitle: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  cancel: { fontFamily: font.medium, fontSize: 14, color: colors.muted },
  done: { fontFamily: font.bold, fontSize: 14, color: colors.primary },
  picker: { alignSelf: 'stretch' },
});

import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert } from '@/lib/alert';
import { TextField } from '@/components/ui/TextField';
import { useRemovePoints } from '@/hooks/useLedare';
import type { LedareYouth } from '@/lib/types';
import { colors, font } from '@/theme/tokens';

const SNABBVAL = [10, 25, 50];

/**
 * Ta bort poäng från en ungdom (0034).
 *
 * Bara avdrag. Poäng delas ut genom närvaro — en ledare som kunde skriva in
 * valfri summa hade gjort incheckningen till en formalitet. XP och märken rörs
 * inte: det man har gjort står kvar även när kassan rättas.
 */
export function JusteraPoang({
  fid,
  youth,
  onClose,
}: {
  fid: string;
  youth: LedareYouth;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const remove = useRemovePoints();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const n = parseInt(amount) || 0;
  const kvar = youth.points - n;
  const forMycket = n > youth.points;
  const kanSpara = n > 0 && !forMycket && !remove.isPending;

  const onSubmit = () => {
    if (!kanSpara) return;
    Alert.alert(
      `Ta bort ${n} poäng?`,
      `${youth.name} har ${youth.points} poäng och får ${kvar} kvar. Hen får en notis om det.`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Ta bort',
          style: 'destructive',
          onPress: () =>
            remove.mutate(
              { forening: fid, user: youth.user_id, amount: n, reason: reason.trim() || null },
              { onSuccess: onClose },
            ),
        },
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
            <Text style={styles.title}>Justera poäng</Text>
            <View style={{ width: 52 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            automaticallyAdjustKeyboardInsets
          >
            <View style={styles.saldoCard}>
              <View style={[styles.avatar, { backgroundColor: youth.avatar_color }]}>
                <Text style={styles.avatarText}>{youth.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{youth.name}</Text>
                <Text style={styles.saldo}>{youth.points} poäng att handla för</Text>
              </View>
            </View>

            <Text style={styles.label}>Ta bort</Text>
            <View style={styles.snabbrad}>
              {SNABBVAL.map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setAmount(String(v))}
                  disabled={v > youth.points}
                  style={[
                    styles.snabb,
                    n === v && styles.snabbVald,
                    v > youth.points && styles.snabbDod,
                  ]}
                >
                  <Text style={[styles.snabbText, n === v && { color: colors.white }]}>−{v}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setAmount(String(youth.points))}
                disabled={youth.points === 0}
                style={[
                  styles.snabb,
                  n === youth.points && youth.points > 0 && styles.snabbVald,
                  youth.points === 0 && styles.snabbDod,
                ]}
              >
                <Text
                  style={[
                    styles.snabbText,
                    n === youth.points && youth.points > 0 && { color: colors.white },
                  ]}
                >
                  Allt
                </Text>
              </Pressable>
            </View>

            <TextField
              placeholder="Antal poäng"
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              style={{ marginTop: 10 }}
            />
            <TextField
              placeholder="Anledning (valfri) — syns för ungdomen"
              value={reason}
              onChangeText={setReason}
              style={{ marginTop: 10 }}
            />

            <Text style={[styles.hint, forMycket && styles.hintFel]}>
              {forMycket
                ? `${youth.name.split(' ')[0]} har bara ${youth.points} poäng.`
                : n > 0
                  ? `Kvar efter avdraget: ${kvar} poäng. XP och märken påverkas inte.`
                  : 'XP och märken påverkas inte — bara poängen att handla för.'}
            </Text>

            <Pressable
              onPress={onSubmit}
              disabled={!kanSpara}
              style={[styles.deleteBtn, !kanSpara && { opacity: 0.4 }]}
            >
              <Text style={styles.deleteText}>
                {n > 0 ? `Ta bort ${n} poäng` : 'Ta bort poäng'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.adminBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    maxHeight: '90%',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  cancel: { fontFamily: font.medium, fontSize: 13.5, color: colors.muted, width: 52 },
  title: { fontFamily: font.bold, fontSize: 15, color: colors.ink },
  body: { paddingHorizontal: 18, paddingBottom: 16 },

  saldoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: font.semibold, fontSize: 16, color: colors.white },
  name: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  saldo: { fontFamily: font.regular, fontSize: 12, color: colors.muted2, marginTop: 2 },

  label: { fontFamily: font.semibold, fontSize: 12.5, color: colors.muted, marginTop: 16 },
  snabbrad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  snabb: {
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 16,
  },
  snabbVald: { backgroundColor: colors.ink },
  snabbDod: { opacity: 0.35 },
  snabbText: { fontFamily: font.semibold, fontSize: 12.5, color: colors.muted },

  hint: { fontFamily: font.regular, fontSize: 12, color: colors.muted2, marginTop: 12, lineHeight: 17 },
  hintFel: { color: '#b91c1c' },

  deleteBtn: {
    marginTop: 18,
    backgroundColor: '#fee2e2',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  deleteText: { fontFamily: font.semibold, fontSize: 13.5, color: '#b91c1c' },
});

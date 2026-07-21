import React, { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon, IconName } from '@/components/Icon';
import { TextField } from '@/components/ui/TextField';
import { useAddReward, useLedareRewards, useSetRewardStock } from '@/hooks/useLedare';
import { ICON_TINT, colors, font, gradients } from '@/theme/tokens';
import { toast } from '@/store/toast';

const ICON_OPTIONS: { value: IconName; label: string }[] = [
  { value: 'film', label: 'Bio / event' },
  { value: 'coffee', label: 'Fika' },
  { value: 'shirt', label: 'Prylar / merch' },
  { value: 'ticket', label: 'Biljett' },
  { value: 'gamepad', label: 'Gaming' },
];
const TINTS: Record<string, string> = {
  film: '#ede7ff', coffee: '#fff3e0', shirt: '#fee2e2', ticket: '#dcfce7', gamepad: '#e0f2fe',
};

export function Beloningar({ fid }: { fid: string }) {
  const { data: rewards } = useLedareRewards(fid);
  const add = useAddReward();
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState<IconName>('film');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const setRewardStock = useSetRewardStock();

  const onAdd = () => {
    if (!title.trim()) {
      toast('Skriv ett namn');
      return;
    }
    add.mutate(
      {
        forening_id: fid,
        title: title.trim(),
        icon,
        tint: TINTS[icon] ?? '#f0ebff',
        cost: parseInt(cost) || 100,
        // Blank means unlimited, which is what every reward was before this.
        stock: stock.trim() === '' ? null : Math.max(0, parseInt(stock) || 0),
      },
      { onSuccess: () => { setTitle(''); setCost(''); setStock(''); setIcon('film'); } },
    );
  };

  return (
    <View>
      <Card style={styles.form}>
        <Text style={styles.formTitle}>Ny belöning</Text>
        <TextField placeholder="Namn, t.ex. Biobiljett" value={title} onChangeText={setTitle} style={styles.input} />

        <Text style={styles.pickLabel}>Ikon</Text>
        <View style={styles.iconRow}>
          {ICON_OPTIONS.map((o) => (
            <Pressable
              key={o.value}
              onPress={() => setIcon(o.value)}
              style={[styles.iconPill, { backgroundColor: icon === o.value ? colors.ink : colors.white }]}
            >
              <Icon name={o.value} size={17} color={icon === o.value ? colors.white : colors.muted} />
            </Pressable>
          ))}
        </View>

        <TextField placeholder="Kostnad i poäng" value={cost} onChangeText={setCost} keyboardType="number-pad" style={styles.input} />
        <TextField placeholder="Antal, t.ex. 15 (tomt = obegränsat)" value={stock} onChangeText={setStock} keyboardType="number-pad" style={styles.input} />

        <Pressable disabled={add.isPending} onPress={onAdd}>
          <LinearGradient colors={gradients.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addBtn}>
            <Text style={styles.addText}>Lägg till belöning</Text>
          </LinearGradient>
        </Pressable>
      </Card>

      <Text style={styles.section}>Belöningar i butiken</Text>
      {(rewards ?? []).map((r) => {
        const left = r.stock == null ? null : Math.max(0, r.stock - r.taken);
        return (
          <Card key={r.id} style={styles.rewardRow}>
            <View style={[styles.rewardTile, { backgroundColor: r.tint }]}>
              <Icon name={r.icon as IconName} size={22} color={ICON_TINT[r.icon] ?? colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{r.title}</Text>
              <Text style={styles.sub}>
                {r.stock == null
                  ? `${r.taken} uttagna · obegränsat`
                  : `${r.taken} av ${r.stock} uttagna${left === 0 ? ' · slut' : ` · ${left} kvar`}`}
              </Text>
              <View style={styles.stockRow}>
                <Text style={styles.stockLabel}>Antal</Text>
                <TextField
                  placeholder={r.stock == null ? 'Obegränsat' : String(r.stock)}
                  defaultValue={r.stock == null ? '' : String(r.stock)}
                  keyboardType="number-pad"
                  onEndEditing={(e) => {
                    const raw = e.nativeEvent.text.trim();
                    const next = raw === '' ? null : Math.max(0, parseInt(raw) || 0);
                    if (next !== r.stock) setRewardStock.mutate({ reward: r.id, stock: next });
                  }}
                  style={styles.stockField}
                />
              </View>
            </View>
            <Text style={styles.cost}>{r.cost}p</Text>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: 15 },
  formTitle: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  input: { marginTop: 10 },
  pickLabel: { fontFamily: font.medium, fontSize: 12.5, color: colors.ink, marginTop: 12, marginBottom: 8 },
  iconRow: { flexDirection: 'row', gap: 8 },
  iconPill: {
    width: 42, height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: colors.inputBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtn: { marginTop: 12, paddingVertical: 12, borderRadius: 13, alignItems: 'center' },
  addText: { fontFamily: font.semibold, fontSize: 13.5, color: colors.white },
  section: { fontFamily: font.semibold, fontSize: 14, color: colors.ink, marginTop: 18, marginBottom: 4 },
  rewardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, marginTop: 11 },
  rewardTile: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  sub: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2 },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  stockLabel: { fontFamily: font.medium, fontSize: 11.5, color: colors.muted },
  // Overrides TextField's full-width form styling for this inline use.
  stockField: { width: 120, paddingVertical: 8, fontSize: 14 },
  cost: { fontFamily: font.bold, fontSize: 13, color: colors.primary },
});

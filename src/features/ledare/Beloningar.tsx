import React, { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { DateTimeField } from '@/components/DateTimeField';
import { Icon, IconName } from '@/components/Icon';
import { TextField } from '@/components/ui/TextField';
import {
  useAddReward, useDeleteMarknad, useLedareMarknader, useLedareRewards, useSaveMarknad,
  useSetRewardAvailability, useSetRewardStock,
} from '@/hooks/useLedare';
import { fmtDateTime } from '@/lib/date';
import type { RewardAvailability } from '@/lib/types';
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

const AVAILABILITY: { value: RewardAvailability; label: string; hint: string }[] = [
  { value: 'marknad', label: 'Marknad', hint: 'Bara när marknaden är öppen' },
  { value: 'alltid', label: 'Alltid', hint: 'Går att köpa när som helst' },
];

export function Beloningar({ fid }: { fid: string }) {
  const { data: rewards } = useLedareRewards(fid);
  const { data: marknader } = useLedareMarknader(fid);
  const add = useAddReward();
  const setRewardStock = useSetRewardStock();
  const setAvailability = useSetRewardAvailability();
  const saveMarknad = useSaveMarknad();
  const deleteMarknad = useDeleteMarknad();

  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState<IconName>('film');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const [availability, setAvail] = useState<RewardAvailability>('marknad');
  const [limit, setLimit] = useState('1');

  const [mName, setMName] = useState('');
  const [mOpens, setMOpens] = useState<Date | null>(null);
  const [mCloses, setMCloses] = useState<Date | null>(null);

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
        availability,
        limit_per_member: limit.trim() === '' ? null : Math.max(1, parseInt(limit) || 1),
      },
      {
        onSuccess: () => {
          setTitle(''); setCost(''); setStock(''); setIcon('film');
          setAvail('marknad'); setLimit('1');
        },
      },
    );
  };

  const onAddMarknad = () => {
    if (!mOpens || !mCloses) return toast('Välj när marknaden öppnar och stänger');
    if (mCloses <= mOpens) return toast('Marknaden måste stänga efter att den öppnat');
    saveMarknad.mutate(
      { forening: fid, name: mName.trim() || 'Marknad', opensAt: mOpens.toISOString(), closesAt: mCloses.toISOString() },
      { onSuccess: () => { setMName(''); setMOpens(null); setMCloses(null); } },
    );
  };

  const onDeleteMarknad = (id: string, namn: string) => {
    Alert.alert('Ta bort marknaden', `Ta bort "${namn}"? Redan gjorda uttag påverkas inte.`, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Ta bort', style: 'destructive', onPress: () => deleteMarknad.mutate(id) },
    ]);
  };

  return (
    <View>
      {/* ---------- Marknaden ---------- */}
      <View style={styles.info}>
        <Text style={styles.infoTitle}>Marknaden</Text>
        <Text style={styles.infoText}>
          Lägg upp när butiken är öppen — till exempel några dagar varannan månad. Belöningar märkta
          Marknad går bara att lösa in då, medan Alltid (en pizzabit, en fika) fungerar däremellan.
          Lägger ni inte upp någon marknad alls är butiken alltid öppen.
        </Text>
      </View>

      <Card style={styles.form}>
        <Text style={styles.formTitle}>Ny marknad</Text>
        <TextField placeholder="Namn, t.ex. Höstmarknaden" value={mName} onChangeText={setMName} style={styles.input} />

        <Text style={styles.pickLabel}>Öppnar</Text>
        <DateTimeField value={mOpens} onChange={setMOpens} />
        <Text style={styles.pickLabel}>Stänger</Text>
        <DateTimeField value={mCloses} onChange={setMCloses} />

        <Pressable disabled={saveMarknad.isPending} onPress={onAddMarknad}>
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addBtn}>
            <Text style={styles.addText}>Lägg upp marknad</Text>
          </LinearGradient>
        </Pressable>
      </Card>

      {(marknader ?? []).length > 0 && (
        <>
          <Text style={styles.section}>Inplanerade marknader</Text>
          {(marknader ?? []).map((m) => (
            <Card key={m.id} style={styles.marknadRow}>
              <View style={[styles.marknadTile, { backgroundColor: m.oppen ? colors.tintGreen : colors.tintPurple }]}>
                <Icon name={m.oppen ? 'bag' : 'calendar'} size={19} color={m.oppen ? colors.green2 : colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {m.name}{m.oppen ? ' · öppen nu' : ''}
                </Text>
                <Text style={styles.sub}>
                  {fmtDateTime(new Date(m.opens_at))} → {fmtDateTime(new Date(m.closes_at))}
                </Text>
              </View>
              <Pressable onPress={() => onDeleteMarknad(m.id, m.name)} hitSlop={8}>
                <Text style={styles.removeLink}>Ta bort</Text>
              </Pressable>
            </Card>
          ))}
        </>
      )}

      {/* ---------- Ny belöning ---------- */}
      <Text style={styles.section}>Ny belöning</Text>
      <Card style={styles.form}>
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

        <Text style={styles.pickLabel}>När går den att köpa?</Text>
        <View style={styles.segment}>
          {AVAILABILITY.map((a) => {
            const on = availability === a.value;
            return (
              <Pressable
                key={a.value}
                onPress={() => {
                  setAvail(a.value);
                  // En pizzabit ska kunna köpas om och om igen; en biobiljett en gång.
                  setLimit(a.value === 'alltid' ? '' : '1');
                }}
                style={[styles.seg, { backgroundColor: on ? colors.ink : colors.white }]}
              >
                <Text style={[styles.segLabel, { color: on ? colors.white : colors.ink }]}>{a.label}</Text>
                <Text style={[styles.segHint, { color: on ? 'rgba(255,255,255,0.75)' : colors.muted2 }]}>{a.hint}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextField placeholder="Kostnad i poäng" value={cost} onChangeText={setCost} keyboardType="number-pad" style={styles.input} />
        <TextField placeholder="Antal totalt, t.ex. 15 (tomt = obegränsat)" value={stock} onChangeText={setStock} keyboardType="number-pad" style={styles.input} />
        <TextField placeholder="Max per person (tomt = obegränsat)" value={limit} onChangeText={setLimit} keyboardType="number-pad" style={styles.input} />

        <Pressable disabled={add.isPending} onPress={onAdd}>
          <LinearGradient colors={gradients.success} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.addBtn}>
            <Text style={styles.addText}>Lägg till belöning</Text>
          </LinearGradient>
        </Pressable>
      </Card>

      {/* ---------- Katalogen ---------- */}
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
                {r.kopbar ? '' : ' · stängd tills marknaden öppnar'}
              </Text>

              <View style={styles.pillRow}>
                {AVAILABILITY.map((a) => {
                  const on = r.availability === a.value;
                  return (
                    <Pressable
                      key={a.value}
                      onPress={() => setAvailability.mutate({
                        reward: r.id,
                        availability: a.value,
                        limit: a.value === 'alltid' ? null : (r.limit_per_member ?? 1),
                      })}
                      style={[styles.pill, { backgroundColor: on ? colors.ink : colors.adminBg }]}
                    >
                      <Text style={[styles.pillText, { color: on ? colors.white : colors.muted }]}>{a.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

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
              <View style={styles.stockRow}>
                <Text style={styles.stockLabel}>Max/person</Text>
                <TextField
                  placeholder={r.limit_per_member == null ? 'Obegränsat' : String(r.limit_per_member)}
                  defaultValue={r.limit_per_member == null ? '' : String(r.limit_per_member)}
                  keyboardType="number-pad"
                  onEndEditing={(e) => {
                    const raw = e.nativeEvent.text.trim();
                    const next = raw === '' ? null : Math.max(1, parseInt(raw) || 1);
                    if (next !== r.limit_per_member) {
                      setAvailability.mutate({ reward: r.id, availability: r.availability, limit: next });
                    }
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
  info: { marginBottom: 10 },
  infoTitle: { fontFamily: font.bold, fontSize: 16, color: colors.ink },
  infoText: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 4, lineHeight: 18 },

  form: { padding: 15 },
  formTitle: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  input: { marginTop: 10 },
  pickLabel: { fontFamily: font.medium, fontSize: 12.5, color: colors.ink, marginTop: 12, marginBottom: 8 },
  iconRow: { flexDirection: 'row', gap: 8 },
  iconPill: {
    width: 42, height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: colors.inputBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  segment: { flexDirection: 'row', gap: 8 },
  seg: { flex: 1, borderRadius: 13, borderWidth: 1.5, borderColor: colors.inputBorder, paddingVertical: 10, paddingHorizontal: 12 },
  segLabel: { fontFamily: font.semibold, fontSize: 13.5 },
  segHint: { fontFamily: font.regular, fontSize: 10.5, marginTop: 1 },
  addBtn: { marginTop: 14, paddingVertical: 12, borderRadius: 13, alignItems: 'center' },
  addText: { fontFamily: font.semibold, fontSize: 13.5, color: colors.white },

  section: { fontFamily: font.semibold, fontSize: 14, color: colors.ink, marginTop: 20, marginBottom: 4 },
  marknadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 11 },
  marknadTile: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  removeLink: { fontFamily: font.semibold, fontSize: 12, color: colors.pink },

  rewardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 12, marginTop: 11 },
  rewardTile: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  sub: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2 },
  pillRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  pill: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999 },
  pillText: { fontFamily: font.semibold, fontSize: 11.5 },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  stockLabel: { fontFamily: font.medium, fontSize: 11.5, color: colors.muted, width: 74 },
  // Overrides TextField's full-width form styling for this inline use.
  stockField: { width: 120, paddingVertical: 8, fontSize: 14 },
  cost: { fontFamily: font.bold, fontSize: 13, color: colors.primary },
});

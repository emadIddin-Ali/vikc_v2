import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon, IconName } from '@/components/Icon';
import { TextField } from '@/components/ui/TextField';
import { useCreateMission, useLedareMissions } from '@/hooks/useLedare';
import { ICON_TINT, colors, font, gradients } from '@/theme/tokens';
import { toast } from '@/store/toast';

const ICON_OPTIONS: { value: IconName; tint: string }[] = [
  { value: 'target', tint: '#ede7ff' },
  { value: 'heart', tint: '#dcfce7' },
  { value: 'book', tint: '#e0f2fe' },
  { value: 'palette', tint: '#ffe9d6' },
  { value: 'soccer', tint: '#e0f2fe' },
  { value: 'moon', tint: '#f0ebff' },
];

export function Uppdrag({ fid }: { fid: string }) {
  const { data: missions } = useLedareMissions(fid);
  const create = useCreateMission();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [goal, setGoal] = useState('');
  const [xp, setXp] = useState('');
  const [icon, setIcon] = useState<IconName>('target');
  const [autoVisit, setAutoVisit] = useState(true);

  const onCreate = () => {
    if (!title.trim()) {
      toast('Skriv ett namn');
      return;
    }
    const tint = ICON_OPTIONS.find((o) => o.value === icon)?.tint ?? '#ede7ff';
    create.mutate(
      { forening_id: fid, title: title.trim(), description: desc.trim(), icon, tint, goal: parseInt(goal) || 1, xp: parseInt(xp) || 50, auto_visit: autoVisit },
      {
        onSuccess: () => {
          setTitle('');
          setDesc('');
          setGoal('');
          setXp('');
          setIcon('target');
          setAutoVisit(true);
        },
      },
    );
  };

  return (
    <View>
      <View style={styles.info}>
        <Text style={styles.infoTitle}>Så funkar uppdrag</Text>
        <Text style={styles.infoText}>
          Uppdrag är utmaningar ungdomarna löser in för XP. Slå på <Text style={styles.b}>Räkna upp vid incheckning</Text> så ökar framstegen automatiskt varje gång de checkar in (t.ex. "Besök 5 gånger"). Annars är det en manuell utmaning som de löser in när målet är klart.
        </Text>
      </View>

      <Card style={styles.form}>
        <Text style={styles.formTitle}>Nytt uppdrag</Text>
        <TextField placeholder="Namn, t.ex. Besök 5 gånger" value={title} onChangeText={setTitle} style={styles.input} />
        <TextField placeholder="Beskrivning, t.ex. Kom till gården" value={desc} onChangeText={setDesc} style={styles.input} />
        <View style={styles.row}>
          <TextField placeholder="Mål (antal)" value={goal} onChangeText={setGoal} keyboardType="number-pad" style={[styles.input, { flex: 1 }]} />
          <TextField placeholder="XP" value={xp} onChangeText={setXp} keyboardType="number-pad" style={[styles.input, { width: 90 }]} />
        </View>

        <Text style={styles.pickLabel}>Ikon</Text>
        <View style={styles.iconRow}>
          {ICON_OPTIONS.map((o) => (
            <Pressable key={o.value} onPress={() => setIcon(o.value)} style={[styles.iconPill, { backgroundColor: icon === o.value ? colors.ink : colors.white }]}>
              <Icon name={o.value} size={17} color={icon === o.value ? colors.white : colors.muted} />
            </Pressable>
          ))}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Räkna upp vid incheckning</Text>
          <Switch value={autoVisit} onValueChange={setAutoVisit} trackColor={{ true: colors.primary, false: '#d9d2ec' }} thumbColor={colors.white} />
        </View>

        <Pressable disabled={create.isPending} onPress={onCreate}>
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
            <Text style={styles.btnText}>Skapa uppdrag</Text>
          </LinearGradient>
        </Pressable>
      </Card>

      <Text style={styles.section}>Uppdrag i föreningen</Text>
      {(missions ?? []).map((m) => (
        <Card key={m.id} style={styles.missionRow}>
          <View style={[styles.tile, { backgroundColor: m.tint }]}>
            <Icon name={m.icon as IconName} size={22} color={ICON_TINT[m.icon] ?? colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mTitle}>{m.title}</Text>
            <Text style={styles.mSub}>Mål {m.goal} · +{m.xp} XP{m.auto_visit ? ' · auto' : ''}</Text>
          </View>
        </Card>
      ))}
      {(missions ?? []).length === 0 && <Text style={styles.empty}>Inga uppdrag än.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  info: { backgroundColor: '#ece9ff', borderRadius: 16, padding: 14, marginBottom: 4 },
  infoTitle: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  infoText: { fontFamily: font.regular, fontSize: 12, color: '#5b4b86', lineHeight: 17, marginTop: 3 },
  b: { fontFamily: font.semibold },

  form: { padding: 15, marginTop: 12 },
  formTitle: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  input: { marginTop: 10 },
  row: { flexDirection: 'row', gap: 10 },
  pickLabel: { fontFamily: font.medium, fontSize: 12.5, color: colors.ink, marginTop: 12, marginBottom: 8 },
  iconRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  iconPill: { width: 42, height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: colors.inputBorder, alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  switchLabel: { fontFamily: font.medium, fontSize: 13, color: colors.ink },
  btn: { marginTop: 14, paddingVertical: 12, borderRadius: 13, alignItems: 'center' },
  btnText: { fontFamily: font.semibold, fontSize: 13.5, color: colors.white },

  section: { fontFamily: font.semibold, fontSize: 14, color: colors.ink, marginTop: 18, marginBottom: 4 },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 11 },
  tile: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  mTitle: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  mSub: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2 },
  empty: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 14 },
});

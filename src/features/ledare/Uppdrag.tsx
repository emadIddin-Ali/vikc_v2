import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { Icon, IconName } from '@/components/Icon';
import { TextField } from '@/components/ui/TextField';
import { EditMission } from '@/features/ledare/EditMission';
import type { Mission, MissionKind } from '@/lib/types';
import { useCreateMission, useLedareMissions } from '@/hooks/useLedare';
import { useBrandGradient } from '@/hooks/useBrandGradient';
import { ICON_TINT, colors, font } from '@/theme/tokens';
import { toast } from '@/store/toast';

const ICON_OPTIONS: { value: IconName; tint: string }[] = [
  { value: 'target', tint: '#ede7ff' },
  { value: 'heart', tint: '#dcfce7' },
  { value: 'book', tint: '#e0f2fe' },
  { value: 'palette', tint: '#ffe9d6' },
  { value: 'soccer', tint: '#e0f2fe' },
  { value: 'moon', tint: '#f0ebff' },
];

const KIND_OPTIONS: { value: MissionKind; label: string; hint: string }[] = [
  { value: 'goal', label: 'Mål', hint: 'Fylls av incheckningar' },
  { value: 'task', label: 'Uppgift', hint: 'Markeras klar av ungdomen' },
];

export function Uppdrag({ fid }: { fid: string }) {
  const brand = useBrandGradient();
  const { data: missions } = useLedareMissions(fid);
  const create = useCreateMission();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [goal, setGoal] = useState('');
  const [xp, setXp] = useState('');
  const [icon, setIcon] = useState<IconName>('target');
  const [kind, setKind] = useState<MissionKind>('goal');
  const [editMission, setEditMission] = useState<Mission | null>(null);

  const onCreate = () => {
    if (!title.trim()) {
      toast('Skriv ett namn');
      return;
    }
    const tint = ICON_OPTIONS.find((o) => o.value === icon)?.tint ?? '#ede7ff';
    const goalNum = kind === 'task' ? 1 : Math.max(parseInt(goal) || 1, 1);
    create.mutate(
      { forening_id: fid, title: title.trim(), description: desc.trim(), icon, tint, goal: goalNum, xp: parseInt(xp) || 50, kind },
      {
        onSuccess: () => {
          setTitle('');
          setDesc('');
          setGoal('');
          setXp('');
          setIcon('target');
          setKind('goal');
        },
      },
    );
  };

  return (
    <View>
      <View style={styles.info}>
        <Text style={styles.infoTitle}>Uppdrag vs aktiviteter</Text>
        <Text style={styles.infoText}>
          <Text style={styles.b}>Aktiviteter</Text> checkar ungdomen in på för poäng direkt. <Text style={styles.b}>Uppdrag</Text> är extra mål som ger XP och finns i två sorter:{'\n'}
          • <Text style={styles.b}>Mål</Text> fylls automatiskt när de checkar in (t.ex. ”Besök 5 gånger”) och löses in när stapeln är full.{'\n'}
          • <Text style={styles.b}>Uppgift</Text> är något de gör själva och markerar klart (t.ex. ”Städa efter dig”).
        </Text>
      </View>

      <Card style={styles.form}>
        <Text style={styles.formTitle}>Nytt uppdrag</Text>

        <Text style={styles.pickLabel}>Typ</Text>
        <View style={styles.segment}>
          {KIND_OPTIONS.map((o) => {
            const on = kind === o.value;
            return (
              <Pressable key={o.value} onPress={() => setKind(o.value)} style={[styles.seg, { backgroundColor: on ? colors.ink : colors.white }]}>
                <Text style={[styles.segLabel, { color: on ? colors.white : colors.ink }]}>{o.label}</Text>
                <Text style={[styles.segHint, { color: on ? 'rgba(255,255,255,0.75)' : colors.muted2 }]}>{o.hint}</Text>
              </Pressable>
            );
          })}
        </View>

        <TextField placeholder={kind === 'goal' ? 'Namn, t.ex. Besök 5 gånger' : 'Namn, t.ex. Städa efter dig'} value={title} onChangeText={setTitle} style={styles.input} />
        <TextField placeholder="Beskrivning, t.ex. Kom till gården" value={desc} onChangeText={setDesc} style={styles.input} />
        <View style={styles.row}>
          {kind === 'goal' && (
            <TextField placeholder="Mål (antal)" value={goal} onChangeText={setGoal} keyboardType="number-pad" style={[styles.input, { flex: 1 }]} />
          )}
          <TextField placeholder="XP" value={xp} onChangeText={setXp} keyboardType="number-pad" style={[styles.input, kind === 'goal' ? { width: 90 } : { flex: 1 }]} />
        </View>

        <Text style={styles.pickLabel}>Ikon</Text>
        <View style={styles.iconRow}>
          {ICON_OPTIONS.map((o) => (
            <Pressable key={o.value} onPress={() => setIcon(o.value)} style={[styles.iconPill, { backgroundColor: icon === o.value ? colors.ink : colors.white }]}>
              <Icon name={o.value} size={17} color={icon === o.value ? colors.white : colors.muted} />
            </Pressable>
          ))}
        </View>

        <Pressable disabled={create.isPending} onPress={onCreate}>
          <LinearGradient colors={brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
            <Text style={styles.btnText}>Skapa uppdrag</Text>
          </LinearGradient>
        </Pressable>
      </Card>

      <Text style={styles.section}>Uppdrag i föreningen</Text>
      {(missions ?? []).map((m) => (
        <Pressable key={m.id} onPress={() => setEditMission(m)}>
          <Card style={styles.missionRow}>
            <View style={[styles.tile, { backgroundColor: m.tint }]}>
              <Icon name={m.icon as IconName} size={22} color={ICON_TINT[m.icon] ?? colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.mTitle}>{m.title}</Text>
              <Text style={styles.mSub}>
                {m.kind === 'goal' ? `Mål ${m.goal} · fylls av incheckning` : 'Uppgift · markeras klar'} · +{m.xp} XP · tryck för att ändra
              </Text>
            </View>
          </Card>
        </Pressable>
      ))}
      {(missions ?? []).length === 0 && <Text style={styles.empty}>Inga uppdrag än.</Text>}

      {editMission && <EditMission mission={editMission} onClose={() => setEditMission(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  info: { backgroundColor: '#ece9ff', borderRadius: 16, padding: 14, marginBottom: 4 },
  infoTitle: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  infoText: { fontFamily: font.regular, fontSize: 12, color: '#5b4b86', lineHeight: 18, marginTop: 3 },
  b: { fontFamily: font.semibold },

  form: { padding: 15, marginTop: 12 },
  formTitle: { fontFamily: font.semibold, fontSize: 14, color: colors.ink },
  input: { marginTop: 10 },
  row: { flexDirection: 'row', gap: 10 },
  pickLabel: { fontFamily: font.medium, fontSize: 12.5, color: colors.ink, marginTop: 12, marginBottom: 8 },

  segment: { flexDirection: 'row', gap: 8 },
  seg: { flex: 1, borderRadius: 13, borderWidth: 1.5, borderColor: colors.inputBorder, paddingVertical: 10, paddingHorizontal: 12 },
  segLabel: { fontFamily: font.semibold, fontSize: 13.5 },
  segHint: { fontFamily: font.regular, fontSize: 10.5, marginTop: 1 },

  iconRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  iconPill: { width: 42, height: 42, borderRadius: 12, borderWidth: 1.5, borderColor: colors.inputBorder, alignItems: 'center', justifyContent: 'center' },
  btn: { marginTop: 14, paddingVertical: 12, borderRadius: 13, alignItems: 'center' },
  btnText: { fontFamily: font.semibold, fontSize: 13.5, color: colors.white },

  section: { fontFamily: font.semibold, fontSize: 14, color: colors.ink, marginTop: 18, marginBottom: 4 },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginTop: 11 },
  tile: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  mTitle: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  mSub: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2 },
  empty: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 14 },
});

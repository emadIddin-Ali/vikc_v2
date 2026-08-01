import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { Card } from '@/components/Card';
import { Icon } from '@/components/Icon';
import { TextField } from '@/components/ui/TextField';
import {
  useForening, useLedareRegister, useRotateJoinCode, useSetForeningRequirePnr, useSetForeningWeekGoal,
  useUpdateForeningInfo,
} from '@/hooks/useLedare';
import { useBrandGradient } from '@/hooks/useBrandGradient';
import { pickImage, uploadForeningLogo } from '@/lib/photo';
import { formatPnr } from '@/lib/pnr';
import { colors, font } from '@/theme/tokens';
import { toast } from '@/store/toast';

export function ForeningInfo({ fid }: { fid: string }) {
  const brand = useBrandGradient();
  const { data: forening } = useForening(fid);
  const save = useUpdateForeningInfo();
  const setRequirePnr = useSetForeningRequirePnr();
  const setWeekGoal = useSetForeningWeekGoal();
  const rotateCode = useRotateJoinCode();
  const { data: register } = useLedareRegister(fid);
  const [showRegister, setShowRegister] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [goal, setGoal] = useState('2');
  const [goalXp, setGoalXp] = useState('150');
  const [goalPoints, setGoalPoints] = useState('50');

  // Prefill once the fresh förening loads (keyed on id so switching förening reloads).
  useEffect(() => {
    if (!forening) return;
    setName(forening.name ?? '');
    setDescription(forening.description ?? '');
    setAddress(forening.address ?? '');
    setPhone(forening.phone ?? '');
    setEmail(forening.email ?? '');
    setOpeningHours(forening.opening_hours ?? '');
    setLogoUrl(forening.logo_url ?? null);
    setGoal(String(forening.week_goal ?? 2));
    setGoalXp(String(forening.week_goal_xp ?? 150));
    setGoalPoints(String(forening.week_goal_points ?? 50));
  }, [forening?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPickLogo = async () => {
    try {
      const uri = await pickImage();
      if (!uri) return;
      setUploading(true);
      const url = await uploadForeningLogo(uri, fid);
      setLogoUrl(url);
      toast('Logga uppladdad — glöm inte att spara');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Kunde inte ladda upp loggan');
    } finally {
      setUploading(false);
    }
  };

  const onSave = () => {
    if (!name.trim()) return toast('Föreningen måste ha ett namn');
    save.mutate({ forening: fid, name, description, address, phone, email, openingHours, logoUrl });
  };

  return (
    <View>
      <View style={styles.info}>
        <Text style={styles.infoTitle}>Om föreningen</Text>
        <Text style={styles.infoText}>
          Info och logotyp är delade — alla ledare i föreningen ser och redigerar samma sak, och logotypen visas för ungdomarna i appen.
        </Text>
      </View>

      <Card style={styles.card}>
        <Text style={styles.label}>Logotyp</Text>
        <View style={styles.logoRow}>
          <View style={styles.logoBox}>
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logoImg} />
            ) : (
              <Icon name="org" size={30} color={colors.muted2} />
            )}
          </View>
          <Pressable onPress={onPickLogo} disabled={uploading} style={styles.logoBtn}>
            {uploading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Icon name="camera" size={16} color={colors.primary} />
                <Text style={styles.logoBtnText}>{logoUrl ? 'Byt logotyp' : 'Ladda upp logotyp'}</Text>
              </>
            )}
          </Pressable>
        </View>

        <Text style={styles.label}>Namn</Text>
        <TextField placeholder="Föreningens namn" value={name} onChangeText={setName} style={styles.input} />

        <Text style={styles.label}>Beskrivning</Text>
        <TextField
          placeholder="Kort om föreningen — vad ni gör, för vilka …"
          value={description}
          onChangeText={setDescription}
          multiline
          style={[styles.input, styles.multiline]}
        />

        <Text style={styles.label}>Adress</Text>
        <TextField placeholder="Gata, postnummer, ort" value={address} onChangeText={setAddress} style={styles.input} />

        <Text style={styles.label}>Telefon</Text>
        <TextField placeholder="Telefonnummer" value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} />

        <Text style={styles.label}>E-post</Text>
        <TextField placeholder="kontakt@foreningen.se" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={styles.input} />

        <Text style={styles.label}>Öppettider</Text>
        <TextField
          placeholder={'T.ex.\nMån–Fre 15–21\nLör 12–18'}
          value={openingHours}
          onChangeText={setOpeningHours}
          multiline
          style={[styles.input, styles.multiline]}
        />

        <Pressable disabled={save.isPending || uploading} onPress={onSave}>
          <LinearGradient colors={brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.saveBtn}>
            <Text style={styles.saveText}>{save.isPending ? 'Sparar…' : 'Spara'}</Text>
          </LinearGradient>
        </Pressable>
      </Card>

      {/* Föreningskoden — ledaren delar ut den, så den måste gå att både se
          och byta. Den satt tidigare bara i kommunens vy. */}
      <Card style={[styles.card, { marginTop: 12 }]}>
        <Text style={styles.switchLabel}>Föreningskod</Text>
        <Text style={styles.switchHint}>
          Koden nya medlemmar skriver in för att gå med. Har den spridits vidare till fel personer kan du
          byta den — ingen som redan är med förlorar sin plats.
        </Text>
        <View style={styles.codeRow}>
          <Text style={styles.code}>{forening?.join_code ?? '—'}</Text>
          <Pressable
            onPress={() =>
              Alert.alert(
                'Byt föreningskod',
                'Den gamla koden slutar fungera direkt. Alla som redan är medlemmar påverkas inte.',
                [
                  { text: 'Avbryt', style: 'cancel' },
                  { text: 'Byt kod', style: 'destructive', onPress: () => rotateCode.mutate(fid) },
                ],
              )}
            disabled={rotateCode.isPending}
            style={styles.codeBtn}
          >
            <Text style={styles.codeBtnText}>Byt kod</Text>
          </Pressable>
        </View>
      </Card>

      {/* Register med personnummer */}
      <Card style={styles.card}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.switchLabel}>Kräv personnummer</Text>
            <Text style={styles.switchHint}>
              Nya medlemmar och barn måste ange personnummer när de går med. Personnummer är känsliga
              uppgifter — se till att det finns i er integritetspolicy.
            </Text>
          </View>
          <Switch
            value={forening?.require_personnummer ?? false}
            disabled={setRequirePnr.isPending || !forening}
            onValueChange={(on) => setRequirePnr.mutate({ forening: fid, require: on })}
            trackColor={{ true: colors.primary, false: '#d9d2ec' }}
            thumbColor={colors.white}
          />
        </View>

        <Pressable onPress={() => setShowRegister((v) => !v)} style={styles.registerToggle}>
          <Icon name="org" size={16} color={colors.primary} />
          <Text style={styles.registerToggleText}>
            {showRegister ? 'Dölj register' : `Visa register (${register?.length ?? 0})`}
          </Text>
          <Icon name="chev" size={16} color={colors.primary} />
        </Pressable>

        {showRegister && (
          (register ?? []).length === 0 ? (
            <Text style={styles.registerEmpty}>Inga medlemmar än.</Text>
          ) : (
            (register ?? []).map((r, i) => (
              <View key={i} style={styles.registerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.registerName}>{r.name}</Text>
                  <Text style={styles.registerRole}>{roleLabel(r.role)}</Text>
                </View>
                <Text style={styles.registerPnr}>{formatPnr(r.personnummer)}</Text>
              </View>
            ))
          )
        )}
      </Card>

      {/* Veckomålet — appens puls. Nollställs varje måndag. */}
      <Card style={[styles.card, { marginTop: 12 }]}>
        <Text style={styles.switchLabel}>Veckomål</Text>
        <Text style={styles.switchHint}>
          Så många besök i veckan ger en bonus. Målet nollställs varje måndag, vilket ger medlemmarna
          en anledning att komma tillbaka innan veckan är slut. Sätt 0 för att stänga av det.
        </Text>

        <View style={styles.goalRow}>
          <View style={styles.goalCol}>
            <Text style={styles.goalLabel}>Besök</Text>
            <TextField value={goal} onChangeText={setGoal} keyboardType="number-pad" style={styles.goalField} />
          </View>
          <View style={styles.goalCol}>
            <Text style={styles.goalLabel}>XP</Text>
            <TextField value={goalXp} onChangeText={setGoalXp} keyboardType="number-pad" style={styles.goalField} />
          </View>
          <View style={styles.goalCol}>
            <Text style={styles.goalLabel}>Poäng</Text>
            <TextField value={goalPoints} onChangeText={setGoalPoints} keyboardType="number-pad" style={styles.goalField} />
          </View>
        </View>

        <Pressable
          disabled={setWeekGoal.isPending}
          onPress={() => setWeekGoal.mutate({
            forening: fid,
            goal: Math.max(parseInt(goal, 10) || 0, 0),
            xp: Math.max(parseInt(goalXp, 10) || 0, 0),
            points: Math.max(parseInt(goalPoints, 10) || 0, 0),
          })}
          style={styles.goalSave}
        >
          <Text style={styles.goalSaveText}>Spara veckomål</Text>
        </Pressable>
      </Card>
    </View>
  );
}

function roleLabel(role: string): string {
  if (role === 'ledare') return 'Ledare';
  if (role === 'foralder') return 'Förälder';
  if (role === 'barn') return 'Barn';
  return 'Ungdom';
}

const styles = StyleSheet.create({
  info: { backgroundColor: '#ece9ff', borderRadius: 16, padding: 14, marginBottom: 12 },
  infoTitle: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  infoText: { fontFamily: font.regular, fontSize: 12, color: '#5b4b86', lineHeight: 17, marginTop: 3 },

  card: { padding: 15 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  code: { fontFamily: font.bold, fontSize: 24, color: colors.ink, letterSpacing: 3 },
  codeBtn: { borderRadius: 12, borderWidth: 1.5, borderColor: colors.inputBorder, paddingVertical: 9, paddingHorizontal: 14 },
  codeBtnText: { fontFamily: font.semibold, fontSize: 12.5, color: colors.muted },

  goalRow: { flexDirection: 'row', gap: 9, marginTop: 12 },
  goalCol: { flex: 1 },
  goalLabel: { fontFamily: font.medium, fontSize: 11, color: colors.muted, marginBottom: 4, textAlign: 'center' },
  goalField: { paddingVertical: 10, paddingHorizontal: 6, textAlign: 'center', fontSize: 14 },
  goalSave: { marginTop: 14, backgroundColor: colors.ink, borderRadius: 13, paddingVertical: 12, alignItems: 'center' },
  goalSaveText: { fontFamily: font.semibold, fontSize: 13.5, color: colors.white },
  label: { fontFamily: font.semibold, fontSize: 12.5, color: colors.ink, marginTop: 14, marginBottom: 8 },
  input: { marginTop: 0 },
  multiline: { minHeight: 80, paddingTop: 12, textAlignVertical: 'top' },

  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logoBox: {
    width: 76, height: 76, borderRadius: 20, backgroundColor: colors.adminBg,
    borderWidth: 1.5, borderColor: colors.inputBorder, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  logoImg: { width: '100%', height: '100%' },
  logoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 15,
    borderRadius: 12, borderWidth: 1.5, borderColor: colors.inputBorder,
  },
  logoBtnText: { fontFamily: font.semibold, fontSize: 13, color: colors.primary },

  saveBtn: { marginTop: 20, paddingVertical: 13, borderRadius: 13, alignItems: 'center' },
  saveText: { fontFamily: font.semibold, fontSize: 14, color: colors.white },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { fontFamily: font.semibold, fontSize: 13.5, color: colors.ink },
  switchHint: { fontFamily: font.regular, fontSize: 11.5, color: colors.muted2, marginTop: 3, lineHeight: 16 },
  registerToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingVertical: 6 },
  registerToggleText: { flex: 1, fontFamily: font.semibold, fontSize: 13, color: colors.primary },
  registerEmpty: { fontFamily: font.regular, fontSize: 12.5, color: colors.muted2, marginTop: 10 },
  registerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.inputBorder,
  },
  registerName: { fontFamily: font.semibold, fontSize: 13, color: colors.ink },
  registerRole: { fontFamily: font.regular, fontSize: 11, color: colors.muted2, marginTop: 1 },
  registerPnr: { fontFamily: font.medium, fontSize: 12.5, color: colors.ink },
});

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthCta, AuthField, AuthScaffold, C, F, authStyles } from '@/components/auth/AuthScaffold';
import { authError } from '@/lib/authError';
import { type JoinRole, useAuth } from '@/providers/AuthProvider';

const ROLES: { value: JoinRole; label: string; hint: string }[] = [
  { value: 'ungdom', label: 'Ungdom', hint: 'Jag deltar själv' },
  { value: 'foralder', label: 'Förälder', hint: 'Jag checkar in mina barn' },
  { value: 'larare', label: 'Lärare', hint: 'Jag undervisar en klass — en ledare godkänner dig' },
];

export default function Join() {
  const { joinForeningByCode, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [role, setRole] = useState<JoinRole>('ungdom');
  const [personnummer, setPersonnummer] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onJoin = async () => {
    setBusy(true);
    setErr(null);
    const { error } = await joinForeningByCode(code, role, personnummer.trim() || null);
    setBusy(false);
    if (error) setErr(authError(error));
    // On success the membership appears → the auth layout redirects to the right area.
  };

  return (
    <AuthScaffold altLabel="Logga ut" onAlt={signOut} showBack={false}>
      <Text style={authStyles.title}>Gå med i en förening</Text>
      <Text style={authStyles.subtitle}>Ange koden du fått av din ledare</Text>

      <View style={{ height: 28 }} />

      <Text style={styles.label}>Jag är …</Text>
      <View style={styles.segment}>
        {ROLES.map((r) => {
          const on = role === r.value;
          return (
            <Pressable
              key={r.value}
              onPress={() => setRole(r.value)}
              style={[styles.seg, on && styles.segOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.segLabel, on && styles.segLabelOn]}>{r.label}</Text>
              <Text style={[styles.segHint, on && styles.segHintOn]}>{r.hint}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: 16 }} />

      <AuthField
        label="Föreningskod"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      {__DEV__ ? <Text style={styles.hint}>Testkoder: CENTRUM · NORRBY · VASTER</Text> : null}

      {/* Registret gäller deltagarna, inte personalen — lärare slipper fältet. */}
      {role !== 'larare' && (
        <>
          <View style={{ height: 16 }} />
          <AuthField
            label="Personnummer"
            value={personnummer}
            onChangeText={setPersonnummer}
            keyboardType="number-pad"
            autoCorrect={false}
          />
          <Text style={styles.hint}>Ange om din förening kräver det (ÅÅÅÅMMDD-XXXX).</Text>
        </>
      )}

      {err ? (
        <Text style={authStyles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          {err}
        </Text>
      ) : null}

      <AuthCta label="Gå med" loadingLabel="Går med…" busy={busy} onPress={onJoin} />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: F.semibold, fontSize: 13, color: C.ink, marginBottom: 10 },
  // Kolumn, inte rad: tre roller med förklaring får inte plats bredvid varandra
  // på en liten skärm utan att texten bryts sönder.
  segment: { gap: 10 },
  seg: {
    borderRadius: 14, borderWidth: 1.5, borderColor: C.hairline, backgroundColor: C.surface,
    paddingVertical: 13, paddingHorizontal: 14,
  },
  segOn: { borderColor: C.brandDeep, backgroundColor: 'rgba(58,43,212,0.06)' },
  segLabel: { fontFamily: F.semibold, fontSize: 15, color: C.ink },
  segLabelOn: { color: C.brandDeep },
  segHint: { fontFamily: F.medium, fontSize: 11.5, color: C.muted, marginTop: 2 },
  segHintOn: { color: C.brandDeep },
  hint: { fontFamily: F.medium, fontSize: 11.5, color: C.muted, marginTop: 8, marginLeft: 4 },
});

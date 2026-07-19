import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { AuthLayout } from '@/components/AuthLayout';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextField } from '@/components/ui/TextField';
import { authError } from '@/lib/authError';
import { colors, font } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function Join() {
  const { joinForeningByCode, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onJoin = async () => {
    setBusy(true);
    setErr(null);
    const { error } = await joinForeningByCode(code);
    setBusy(false);
    if (error) setErr(authError(error));
    // On success the membership appears → the auth layout redirects to the youth area.
  };

  return (
    <AuthLayout
      title="Gå med i en förening"
      subtitle="Ange koden du fått av din ledare"
      footer={
        <Pressable onPress={signOut}>
          <Text style={styles.link}>Logga ut</Text>
        </Pressable>
      }
    >
      <TextField
        placeholder="Föreningskod"
        autoCapitalize="characters"
        autoCorrect={false}
        value={code}
        onChangeText={setCode}
      />
      <Text style={styles.hint}>Testkoder: CENTRUM · NORRBY · VASTER</Text>
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <PrimaryButton label="Gå med" onPress={onJoin} loading={busy} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: font.regular, fontSize: 11.5, color: colors.faint },
  err: { fontFamily: font.medium, fontSize: 12.5, color: colors.pink },
  link: { fontFamily: font.semibold, fontSize: 13, color: colors.primary },
});

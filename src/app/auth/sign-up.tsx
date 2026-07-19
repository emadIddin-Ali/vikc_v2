import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthLayout } from '@/components/AuthLayout';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextField } from '@/components/ui/TextField';
import { authError } from '@/lib/authError';
import { colors, font } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function SignUp() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async () => {
    setBusy(true);
    setErr(null);
    setInfo(null);
    const { error, needsConfirm } = await signUp(email, password, name);
    setBusy(false);
    if (error) {
      setErr(authError(error));
      return;
    }
    if (needsConfirm) {
      setInfo('Konto skapat! Bekräfta din e-post via länken i mejlet och logga sedan in.');
    }
    // If confirmation is off, the auth listener signs the user in automatically.
  };

  return (
    <AuthLayout
      title="Skapa konto"
      subtitle="Kom igång med LEVLA"
      footer={
        <Link href="/auth/login">
          <Text style={styles.link}>Har du redan ett konto? <Text style={styles.linkStrong}>Logga in</Text></Text>
        </Link>
      }
    >
      <TextField placeholder="Ditt namn" autoCapitalize="words" value={name} onChangeText={setName} />
      <TextField
        placeholder="E-post"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField placeholder="Lösenord (minst 6 tecken)" secureTextEntry value={password} onChangeText={setPassword} />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}
      <PrimaryButton label="Skapa konto" onPress={onSubmit} loading={busy} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  err: { fontFamily: font.medium, fontSize: 12.5, color: colors.pink },
  info: { fontFamily: font.medium, fontSize: 12.5, color: colors.green2 },
  link: { fontFamily: font.medium, fontSize: 13, color: colors.muted },
  linkStrong: { fontFamily: font.semibold, color: colors.primary },
});

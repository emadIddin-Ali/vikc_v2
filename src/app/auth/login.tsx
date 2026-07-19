import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { AuthLayout } from '@/components/AuthLayout';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { TextField } from '@/components/ui/TextField';
import { authError } from '@/lib/authError';
import { colors, font } from '@/theme/tokens';
import { useAuth } from '@/providers/AuthProvider';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setBusy(true);
    setErr(null);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) setErr(authError(error));
    // On success the auth listener updates state and the layout redirects.
  };

  return (
    <AuthLayout
      title="Logga in"
      subtitle="Logga in för att fortsätta"
      footer={
        <Link href="/auth/sign-up">
          <Text style={styles.link}>Inget konto? <Text style={styles.linkStrong}>Skapa ett</Text></Text>
        </Link>
      }
    >
      <TextField
        placeholder="E-post"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        placeholder="Lösenord"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <PrimaryButton label="Logga in" onPress={onSubmit} loading={busy} />
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  err: { fontFamily: font.medium, fontSize: 12.5, color: colors.pink },
  link: { fontFamily: font.medium, fontSize: 13, color: colors.muted },
  linkStrong: { fontFamily: font.semibold, color: colors.primary },
});

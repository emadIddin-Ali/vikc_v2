import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthCta, AuthDivider, AuthField, AuthScaffold, C, F, GoogleButton, authStyles } from '@/components/auth/AuthScaffold';
import { Icon } from '@/components/Icon';
import { authError } from '@/lib/authError';
import { signInWithGoogle } from '@/lib/oauth';
import { useAuth } from '@/providers/AuthProvider';

export default function SignUp() {
  const { signUp } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const consentError = 'Du måste godkänna villkoren och integritetspolicyn för att skapa konto.';

  const onSubmit = async () => {
    if (!agreed) { setErr(consentError); return; }
    setBusy(true);
    setErr(null);
    setInfo(null);
    const { error, needsConfirm } = await signUp(email, password, name);
    setBusy(false);
    if (error) { setErr(authError(error)); return; }
    if (needsConfirm) setInfo('Konto skapat! Bekräfta din e-post via länken i mejlet och logga sedan in.');
    // If confirmation is off, the auth listener signs the user in automatically.
  };

  const onGoogle = async () => {
    if (!agreed) { setErr(consentError); return; }
    setErr(null);
    setGoogleBusy(true);
    const { error } = await signInWithGoogle();
    setGoogleBusy(false);
    if (error) setErr(error);
  };

  return (
    <AuthScaffold altPrompt="Har du redan ett konto?" altLabel="Logga in" altHref="/auth/login">
      <Text style={authStyles.title}>Skapa konto</Text>
      <Text style={authStyles.subtitle}>Kom igång med LEVLA</Text>

      <View style={{ height: 30 }} />

      <AuthField
        label="Ditt namn"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
      />

      <View style={{ height: 16 }} />

      <AuthField
        label="E-postadress"
        value={email}
        onChangeText={setEmail}
        autoComplete="email"
        inputMode="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        autoCapitalize="none"
      />

      <View style={{ height: 16 }} />

      <AuthField
        label="Lösenord (minst 6 tecken)"
        value={password}
        onChangeText={setPassword}
        secureToggle
        autoComplete="new-password"
        textContentType="newPassword"
        autoCapitalize="none"
      />

      <Pressable style={styles.consent} onPress={() => setAgreed((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: agreed }}>
        <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
          {agreed && <Icon name="check" size={13} color="#FFFFFF" />}
        </View>
        <Text style={styles.consentText}>
          Jag är minst 13 år eller har målsmans godkännande, och godkänner{' '}
          <Text style={styles.consentLink} onPress={() => router.push('/legal/privacy')}>integritetspolicyn</Text>.
        </Text>
      </Pressable>

      {err ? (
        <Text style={authStyles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          {err}
        </Text>
      ) : null}
      {info ? <Text style={authStyles.info}>{info}</Text> : null}

      <AuthCta label="Skapa konto" loadingLabel="Skapar konto…" busy={busy} onPress={onSubmit} />

      <AuthDivider label="Eller fortsätt med" />

      <GoogleButton onPress={onGoogle} opening={googleBusy} disabled={!agreed} />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 18 },
  checkbox: {
    width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: C.hairline,
    backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxOn: { backgroundColor: C.brandDeep, borderColor: C.brandDeep },
  consentText: { flex: 1, fontFamily: F.medium, fontSize: 12.5, color: C.ink, lineHeight: 18 },
  consentLink: { fontFamily: F.semibold, color: C.brandDeep, textDecorationLine: 'underline' },
});

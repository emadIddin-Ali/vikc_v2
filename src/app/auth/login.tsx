import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthCta, AuthDivider, AuthField, AuthScaffold, C, F, GoogleButton, authStyles } from '@/components/auth/AuthScaffold';
import { authError } from '@/lib/authError';
import { signInWithGoogle } from '@/lib/oauth';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from '@/store/toast';

export default function Login() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setBusy(true);
    setErr(null);
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) {
      const m = error.toLowerCase();
      // Never leak Supabase's raw wording for a failed login.
      setErr(m.includes('invalid') ? 'Fel e-postadress eller lösenord.' : authError(error));
    }
    // On success the auth listener updates state and the layout redirects.
  };

  const onForgot = async () => {
    if (!email.trim()) {
      setErr('Fyll i din e-postadress först, så skickar vi en återställningslänk.');
      return;
    }
    setErr(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) setErr(authError(error.message));
    else toast('Kolla din mejl för att återställa lösenordet.');
  };

  const onGoogle = async () => {
    setErr(null);
    setGoogleBusy(true);
    const { error } = await signInWithGoogle();
    setGoogleBusy(false);
    if (error) setErr(error);
  };

  const fieldError = !!err && err.startsWith('Fel e-postadress');

  return (
    <AuthScaffold altPrompt="Har du inget konto?" altLabel="Skapa konto" altHref="/auth/sign-up">
      <Text style={authStyles.title}>Välkommen tillbaka</Text>
      <Text style={authStyles.subtitle}>Fyll i dina uppgifter nedan</Text>

      <View style={{ height: 30 }} />

      <AuthField
        label="E-postadress"
        value={email}
        onChangeText={setEmail}
        error={fieldError}
        autoComplete="email"
        inputMode="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        autoCapitalize="none"
      />

      <View style={{ height: 16 }} />

      <AuthField
        label="Lösenord"
        value={password}
        onChangeText={setPassword}
        error={fieldError}
        secureToggle
        autoComplete="current-password"
        textContentType="password"
        autoCapitalize="none"
      />

      {err ? (
        <Text style={authStyles.error} accessibilityRole="alert" accessibilityLiveRegion="assertive">
          {err}
        </Text>
      ) : null}

      <AuthCta label="Logga in" loadingLabel="Loggar in…" busy={busy} onPress={onSubmit} />

      <ForgotLink onPress={onForgot} />

      <AuthDivider label="Eller logga in med" />

      <GoogleButton onPress={onGoogle} opening={googleBusy} />
    </AuthScaffold>
  );
}

/** "Glömt ditt lösenord?" — underlined only while pressed. */
function ForgotLink({ onPress }: { onPress: () => void }) {
  const [active, setActive] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setActive(true)}
      onPressOut={() => setActive(false)}
      accessibilityRole="button"
      style={styles.forgot}
    >
      <Text style={[styles.forgotText, active && { textDecorationLine: 'underline' }]}>Glömt ditt lösenord?</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: 'center', marginTop: 24, paddingVertical: 4 },
  forgotText: { fontFamily: F.semibold, fontSize: 15, color: C.ink },
});

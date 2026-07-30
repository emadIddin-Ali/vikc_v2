import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

// Lets the auth browser tab close cleanly when it redirects back.
WebBrowser.maybeCompleteAuthSession();

/**
 * Sign in with Google via the web-based OAuth flow (works in Expo Go).
 *
 * Flow: ask Supabase for the Google auth URL → open it in an in-app browser →
 * Google sends the user back to our app with a `?code=...` (PKCE) → exchange
 * that code for a session. The auth listener in AuthProvider then routes.
 *
 * Requires Supabase-side config (Google provider enabled + this redirect added
 * to the allow-list) — see the README. Returns {} on success/cancel, {error}.
 */
type OAuthProvider = 'google' | 'facebook';

/** Sign in with a web-based OAuth provider (Google/Facebook) via PKCE. */
export async function signInWithProvider(provider: OAuthProvider): Promise<{ error?: string }> {
  try {
    const redirectTo = Linking.createURL('auth/callback');
    // The single most common cause of "Safari kan inte öppna sidan" after OAuth
    // is that this exact URL isn't in Supabase → Authentication → URL
    // Configuration → Redirect URLs. Log it so it can be copied verbatim.
    if (__DEV__) console.log(`[LEVLA] ${provider} redirectTo (lägg i Supabase Redirect URLs):`, redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return { error: error.message };
    if (!data?.url) return { error: 'Kunde inte starta Google-inloggningen.' };

    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    // User closed the browser without finishing — not an error worth showing.
    if (res.type !== 'success') return {};

    const { queryParams } = Linking.parse(res.url);
    const errDesc = (queryParams?.error_description ?? queryParams?.error) as string | undefined;
    if (errDesc) return { error: String(errDesc) };

    const code = queryParams?.code as string | undefined;
    if (!code) {
      // We came back to the app but without a ?code — almost always the redirect
      // fell back to Supabase's Site URL because redirectTo isn't whitelisted.
      return { error: 'Inloggningen kom inte tillbaka rätt. Kontrollera att appens redirect-URL är tillagd i Supabase (se README → Google-inloggning).' };
    }

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) return { error: exchangeError.message };
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Inloggningen misslyckades.' };
  }
}

/** Sign in with Google (see signInWithProvider). */
export function signInWithGoogle(): Promise<{ error?: string }> {
  return signInWithProvider('google');
}

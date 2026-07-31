import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Not fatal at import time, but auth/queries will fail until .env is set.
  console.warn(
    '[LEVLA] Saknar EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Kopiera .env.example till .env och fyll i värdena från ditt Supabase-projekt.',
  );
}

export const supabase = createClient(url ?? '', anon ?? '', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // På webben kommer OAuth tillbaka som en HELSIDESOMDIRIGERING med ?code i
    // adressfältet — då ska klienten plocka upp koden själv. I appen öppnas i
    // stället en inbyggd webbläsare och utbytet sker manuellt i oauth.ts, så
    // där måste automatiken vara av för att de två inte ska krocka.
    detectSessionInUrl: Platform.OS === 'web',
    // PKCE: OAuth (Google) redirects back with a ?code we exchange manually.
    // The code verifier is kept in AsyncStorage by this same client instance.
    flowType: 'pkce',
  },
});

// Refresh the session while the app is in the foreground (Supabase RN guidance).
// Webbläsaren har ingen motsvarighet — där sköter autoRefreshToken det själv,
// och AppState står permanent på 'active'.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

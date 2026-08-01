import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

/** Kanalen som databasens push-trigger (0012) skickar på. */
const CHANNEL = 'default';

// How a notification is presented while the app is in the foreground.
// Webben har ingen motsvarighet — där finns inga notiser att presentera.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Android kräver att kanalen finns innan en push kan landa i den.
 *
 * Triggern i 0012 skickar `channelId: 'default'`. Fanns kanalen inte hamnade
 * notisen i Androids namnlösa reservkanal — utan ljud, utan vibration, och
 * osynlig i systeminställningarna där användaren annars kan styra den.
 */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Notiser',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6c4cf1',
  });
}

/**
 * Register this device's Expo push token for the user.
 *
 * Kräver tre saker som inte kan lösas i kod: ett `projectId` i app.json
 * (`npx eas init`), ett riktigt bygge (Expo Go har inte stött fjärrpush sedan
 * SDK 53) och en fysisk enhet. Saknas något är funktionen tyst — appen ska
 * fungera ändå, notiserna ligger kvar i inkorgen.
 */
export async function registerPushToken(userId: string): Promise<void> {
  try {
    // Webbpush är en annan teknik (VAPID/Service Worker) och går inte genom
    // Expos push-tjänst. Notiserna finns kvar i inkorgen i appen.
    if (Platform.OS === 'web') return;
    if (!Device.isDevice) return;

    const projectId =
      (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ??
      Constants.easConfig?.projectId;
    if (!projectId) {
      if (__DEV__) {
        console.warn(
          '[LEVLA] Push är av: app.json saknar extra.eas.projectId. ' +
            'Kör `npx eas init` och bygg med `eas build` — Expo Go kan inte ta emot fjärrpush.',
        );
      }
      return;
    }

    await ensureAndroidChannel();

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;

    await supabase.from('push_token').upsert({
      user_id: userId,
      token,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    // Expo Go / no push support in this runtime — safely ignore so the app still runs.
    if (__DEV__) console.warn('[LEVLA] Kunde inte registrera push-token:', e);
  }
}

/**
 * Kör `onOpen` när användaren trycker på en notis.
 *
 * Utan det här öppnas appen på den skärm den råkade stå på, och notisen som
 * fick användaren att öppna den leder ingenstans. Returnerar en avregistrering.
 */
export function onNotificationTap(onOpen: () => void): () => void {
  if (Platform.OS === 'web') return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener(() => onOpen());
  return () => sub.remove();
}

/**
 * Remove this user's push token. Called before sign-out so the next person on a
 * shared device doesn't keep receiving the previous user's notifications.
 */
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    await supabase.from('push_token').delete().eq('user_id', userId);
  } catch {
    // Best-effort; never block sign-out on this.
  }
}

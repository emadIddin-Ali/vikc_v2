import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';

// How a notification is presented while the app is in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Register this device's Expo push token for the user.
 * No-op in Expo Go (remote push unsupported since SDK 53) and on simulators —
 * it activates automatically once the app runs as a development/production build.
 */
export async function registerPushToken(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return;

    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;

    const projectId =
      (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ??
      Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    if (!token) return;

    await supabase.from('push_token').upsert({
      user_id: userId,
      token,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Expo Go / no push support in this runtime — safely ignore so the app still runs.
  }
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

import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

/** Open the camera and return the captured photo's local uri (or null if cancelled/denied). */
export async function capturePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({ quality: 0.5 });
  if (res.canceled) return null;
  return res.assets[0]?.uri ?? null;
}

/** Upload a local image uri to the checkin-photos bucket and return its public URL. */
export async function uploadCheckinPhoto(uri: string, userId: string): Promise<string> {
  const arraybuffer = await fetch(uri).then((r) => r.arrayBuffer());
  const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId}/${Date.now()}.${ext}`;
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const { error } = await supabase.storage.from('checkin-photos').upload(path, arraybuffer, { contentType });
  if (error) throw new Error(error.message);
  return supabase.storage.from('checkin-photos').getPublicUrl(path).data.publicUrl;
}

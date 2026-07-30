import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

/** Open the camera and return the captured photo's local uri (or null if cancelled/denied). */
export async function capturePhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  // exif:false keeps GPS/EXIF metadata out of the upload (children's photos).
  const res = await ImagePicker.launchCameraAsync({ quality: 0.5, exif: false });
  if (res.canceled) return null;
  return res.assets[0]?.uri ?? null;
}

/**
 * Upload a local image to the (private) checkin-photos bucket.
 * Returns the storage PATH (e.g. "<uid>/<ts>.jpg"), not a public URL — the
 * bucket is private, so leaders view photos through short-lived signed URLs
 * (see signCheckinPhoto). The server also validates that the path starts with
 * the caller's uid, so photos can't be attributed to someone else.
 */
export async function uploadCheckinPhoto(uri: string, userId: string): Promise<string> {
  const arraybuffer = await fetch(uri).then((r) => r.arrayBuffer());
  const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId}/${Date.now()}.${ext}`;
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const { error } = await supabase.storage.from('checkin-photos').upload(path, arraybuffer, { contentType });
  if (error) throw new Error(error.message);
  return path;
}

/**
 * Turn a stored check-in photo reference into a viewable, short-lived signed URL.
 * Accepts either a bare storage path or a legacy full URL (older rows); returns
 * null if it can't be signed so the caller can fall back to a placeholder.
 */
export async function signCheckinPhoto(pathOrUrl: string | null | undefined): Promise<string | null> {
  if (!pathOrUrl) return null;
  const marker = '/checkin-photos/';
  const idx = pathOrUrl.indexOf(marker);
  const path = idx >= 0 ? pathOrUrl.slice(idx + marker.length) : pathOrUrl;
  const { data, error } = await supabase.storage.from('checkin-photos').createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Pick a square-ish image from the library and return its local uri (or null). */
export async function pickImage(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1], exif: false });
  if (res.canceled) return null;
  return res.assets[0]?.uri ?? null;
}

/** Upload a förening logo to the forening-logos bucket and return its public URL. */
export async function uploadForeningLogo(uri: string, foreningId: string): Promise<string> {
  const arraybuffer = await fetch(uri).then((r) => r.arrayBuffer());
  const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
  const path = `${foreningId}/logo-${Date.now()}.${ext}`;
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const { error } = await supabase.storage.from('forening-logos').upload(path, arraybuffer, { contentType, upsert: true });
  if (error) throw new Error(error.message);
  return supabase.storage.from('forening-logos').getPublicUrl(path).data.publicUrl;
}

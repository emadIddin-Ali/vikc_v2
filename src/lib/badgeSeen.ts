import AsyncStorage from '@react-native-async-storage/async-storage';
import { playSfx } from '@/lib/sfx';
import { supabase } from '@/lib/supabase';
import type { BadgeRow } from '@/lib/types';
import { toast } from '@/store/toast';

/**
 * Badge unlocks are computed, not stored — so there is no server-side "you just
 * earned this" event. We keep the set of already-celebrated codes on the device
 * and diff against it after a check-in.
 */
const key = (userId: string, foreningId: string) => `levla.badges.seen.${userId}.${foreningId}`;

async function readSeen(userId: string, foreningId: string): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId, foreningId));
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

async function writeSeen(userId: string, foreningId: string, codes: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId, foreningId), JSON.stringify(codes));
  } catch {
    // A failed write just means the badge gets celebrated again later.
  }
}

async function fetchUnlocked(foreningId: string): Promise<BadgeRow[]> {
  // Unlocks are computed, so there is no event to hang the XP reward on.
  // sync_badge_xp books any newly unlocked badge and pays out its XP; it is
  // idempotent, so calling it on every badge check is safe.
  await Promise.resolve(supabase.rpc('sync_badge_xp', { p_forening: foreningId })).catch(() => {});
  const { data } = await supabase.rpc('youth_badges', { p_forening: foreningId });
  return ((data as BadgeRow[]) ?? []).filter((b) => b.unlocked);
}

/**
 * Remember what the member already had, so an existing user isn't flooded with
 * "new!" badges the first time they check in after installing this version.
 * No-op once a baseline exists — a brand-new member keeps their empty baseline
 * and so does get Premiär celebrated on their first check-in.
 */
export async function seedBadgeBaseline(userId: string, foreningId: string): Promise<void> {
  if (await readSeen(userId, foreningId)) return;
  const unlocked = await fetchUnlocked(foreningId);
  await writeSeen(userId, foreningId, unlocked.map((b) => b.code));
}

/** Badges unlocked since the last call, and marks them as celebrated. */
export async function claimNewBadges(userId: string, foreningId: string): Promise<BadgeRow[]> {
  const unlocked = await fetchUnlocked(foreningId);
  const seen = new Set((await readSeen(userId, foreningId)) ?? []);
  await writeSeen(userId, foreningId, unlocked.map((b) => b.code));
  return unlocked.filter((b) => !seen.has(b.code));
}

/**
 * Toast any badge unlocked by something other than a check-in — redeeming a
 * reward or claiming a mission. Delayed past the action's own toast (~2.2 s) so
 * the two don't overwrite each other.
 */
export function announceNewBadges(userId: string, foreningId: string, delayMs = 2400): void {
  claimNewBadges(userId, foreningId)
    .then((fresh) => {
      if (fresh.length === 0) return;
      setTimeout(() => {
        toast(fresh.length === 1 ? `Nytt märke: ${fresh[0].name}!` : `${fresh.length} nya märken!`);
        playSfx('badge');
      }, delayMs);
    })
    .catch(() => {});
}

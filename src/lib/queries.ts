import type { QueryClient } from '@tanstack/react-query';

/**
 * Every cached view that shows points, XP, level, streak or the member's own
 * history. A check-in changes all of them at once, so they have to be
 * invalidated as a set — invalidating a hand-picked subset is how the shop and
 * the leaderboard ended up showing yesterday's points after a check-in.
 *
 * The youth screens live in a Tabs navigator, so they stay mounted after the
 * first visit and never remount. Without invalidation their queries are simply
 * never refetched, no matter how long the member waits.
 */
const MEMBER_KEYS = [
  'home',
  'profile',
  'attendance',
  'shop',
  'missions',
  'leaderboard',
  'open-activities',
  'notifications',
] as const;

/** Refetch everything the member's balance is visible in. */
export function invalidateMemberData(qc: QueryClient): void {
  for (const key of MEMBER_KEYS) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

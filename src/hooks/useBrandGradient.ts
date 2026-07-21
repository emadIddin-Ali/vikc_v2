import { useAuth } from '@/providers/AuthProvider';
import { themeGradient } from '@/theme/tokens';

/**
 * The active förening's brand gradient. Youth surfaces read this instead of
 * `gradients.brand` so a ledare's theme choice follows the member into every
 * screen — and a member of two föreningar sees each one's own colours when
 * they switch.
 */
export function useBrandGradient(): readonly [string, string] {
  // activeForening already resolves a kommun admin's "open as leader" förening
  // ahead of the member's own, so leader screens theme correctly too.
  const { activeForening } = useAuth();
  return themeGradient(activeForening?.theme);
}

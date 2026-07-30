import type { IconName } from '@/components/Icon';
import { colors } from '@/theme/tokens';
import type { NarvaroStatus, StarCategory } from '@/lib/types';

/**
 * The star system for the teacher role.
 *
 * A star is a grade on one lesson's effort, and the category records what it
 * was for — without it the stars are just a number and nobody can tell that a
 * student is strong on memorisation but weak on tajwid.
 */
export const STAR_CATEGORIES: { value: StarCategory; label: string; icon: IconName; tint: string }[] = [
  { value: 'hifz',    label: 'Memorering', icon: 'book',     tint: colors.tintPurple },
  { value: 'murajaa', label: 'Repetition', icon: 'target',   tint: colors.tintBlue },
  { value: 'tajwid',  label: 'Tajwid',     icon: 'sparkles', tint: colors.tintYellow },
  { value: 'laxa',    label: 'Läxa',       icon: 'check',    tint: colors.tintGreen },
  { value: 'narvaro', label: 'Närvaro',    icon: 'calendar', tint: colors.tintOrange2 },
  { value: 'adab',    label: 'Adab',       icon: 'heart',    tint: colors.tintPurple2 },
];

export function categoryLabel(v: StarCategory | null | undefined): string {
  return STAR_CATEGORIES.find((c) => c.value === v)?.label ?? 'Stjärna';
}

export const NARVARO: { value: NarvaroStatus; label: string; color: string }[] = [
  { value: 'har',    label: 'Här',    color: colors.green },
  { value: 'sen',    label: 'Sen',    color: colors.orange },
  { value: 'borta',  label: 'Borta',  color: colors.pink },
  { value: 'anmald', label: 'Anmäld', color: colors.muted },
];

export function narvaroLabel(v: NarvaroStatus): string {
  return NARVARO.find((n) => n.value === v)?.label ?? 'Här';
}

/** Fallback curve — mirrors the forening.star_xp default in migration 0028. */
export const DEFAULT_STAR_XP = [25, 60, 110, 180, 300];

/** XP a given star level is worth in this förening. */
export function starXp(curve: number[] | null | undefined, stars: number): number {
  const c = curve?.length === 5 ? curve : DEFAULT_STAR_XP;
  return c[Math.min(Math.max(stars, 1), 5) - 1] ?? 0;
}

const WEEKDAYS = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

export function weekdayName(d: number | null | undefined): string | null {
  return d == null ? null : WEEKDAYS[d] ?? null;
}

/** "Lördag · 10:00" — whichever parts the teacher filled in. */
export function klassWhen(weekday: number | null, timeText: string | null): string {
  return [weekdayName(weekday), timeText].filter(Boolean).join(' · ') || 'Ingen fast tid';
}

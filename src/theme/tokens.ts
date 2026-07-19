/**
 * LEVLA design tokens — extracted from the design handoff (README + prototype).
 * We drive everything from these so the UI stays faithful to the spec.
 */

export const colors = {
  // brand
  primary: '#6c4cf1',
  primary2: '#a24cf1',
  deepPurple: '#3b1e8f',
  // text
  ink: '#2c2340',
  muted: '#8b7ab8',
  muted2: '#9a8bc0',
  faint: '#b3a6d0',
  // status
  green: '#22c55e',
  green2: '#16a34a',
  orange: '#ff7a4d',
  pink: '#ff4d8d',
  gold: '#ffd23f',
  blue: '#2b6bff',
  info: '#0ea5e9',
  // surfaces
  white: '#ffffff',
  overlayDark: '#171226',
  adminBg: '#f4f2fb',
  inputBorder: '#eae4fb',
  navBorder: '#f0ebff',
  // tints
  tintPurple: '#ede7ff',
  tintPurple2: '#f0ebff',
  tintOrange: '#ffe9d6',
  tintOrange2: '#fff3e0',
  tintGreen: '#dcfce7',
  tintBlue: '#e0f2fe',
  tintRed: '#fee2e2',
  tintYellow: '#fef9c3',
  unreadBg: '#f6f2ff',
} as const;

/** LinearGradient color-stop pairs. Use start={{x:0,y:0}} end={{x:1,y:1}} for the "140deg" look. */
export const gradients = {
  brand: ['#6c4cf1', '#a24cf1'] as const,
  levelUp: ['#6c4cf1', '#3b1e8f'] as const,
  weekly: ['#ff7a4d', '#ff4d8d'] as const,
  success: ['#22c55e', '#16a34a'] as const,
  gold: ['#ffd23f', '#ffb800'] as const,
  screen: ['#ece5ff', '#fdf6ef'] as const,
};

export const radius = {
  sm: 12,
  tile: 14,
  md: 16,
  lg: 18,
  card: 22,
  hero: 26,
  phone: 36,
  pill: 999,
} as const;

export const spacing = {
  screen: 18,
  gap: 12,
} as const;

/** RN shadow approximation of the card shadow `0 12px 26px -18px rgba(108,76,241,.5)`. */
export const shadow = {
  card: {
    shadowColor: '#6c4cf1',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  soft: {
    shadowColor: '#6c4cf1',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  hero: {
    shadowColor: '#6c4cf1',
    shadowOpacity: 0.32,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
} as const;

/** Fredoka font families (from @expo-google-fonts/fredoka). Weight is encoded in the file. */
export const font = {
  regular: 'Fredoka_400Regular',
  medium: 'Fredoka_500Medium',
  semibold: 'Fredoka_600SemiBold',
  bold: 'Fredoka_700Bold',
} as const;

export const XP_MAX = 1000;

export const LEVEL_NAMES = [
  'Nyfiken', 'Upptäckare', 'Äventyrare', 'Stigfinnare', 'Utforskare',
  'Rävstig', 'Nivåryttare', 'Stjärnjägare', 'Kometryttare', 'Legend',
];

export function levelName(level: number): string {
  return LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)] || 'Legend';
}

export type ActivityTheme = {
  name: string;
  icon: string;
  bg: readonly [string, string];
  ink: string;
  accent: string;
};

export const THEMES: Record<string, ActivityTheme> = {
  fika:   { name: 'Fika',   icon: 'coffee',   bg: ['#ffe6c2', '#ffb877'], ink: '#5a3611', accent: '#c07a1e' },
  sport:  { name: 'Sport',  icon: 'soccer',   bg: ['#bfe6ff', '#5cc0f5'], ink: '#0b3a52', accent: '#0284c7' },
  musik:  { name: 'Skapar', icon: 'palette',  bg: ['#d9ccff', '#a988ff'], ink: '#33206b', accent: '#6c4cf1' },
  gaming: { name: 'Gaming', icon: 'gamepad',  bg: ['#c3f0d0', '#4fd67f'], ink: '#0d4527', accent: '#16a34a' },
  fest:   { name: 'Event',  icon: 'sparkles', bg: ['#ffcfe9', '#ff7ac0'], ink: '#5c123f', accent: '#db2777' },
  plugg:  { name: 'Plugg',  icon: 'book',     bg: ['#fdeeaa', '#f6cf4a'], ink: '#4d3a02', accent: '#caa500' },
};

export function activityTheme(id: string): ActivityTheme {
  return THEMES[id] ?? THEMES.fika;
}

/** Accent color per icon (mission/notification/reward tiles). */
export const ICON_TINT: Record<string, string> = {
  target: '#6c4cf1', palette: '#ff7a4d', heart: '#22c55e', book: '#0ea5e9',
  coffee: '#c07a1e', film: '#6c4cf1', ticket: '#22c55e', shirt: '#e05a6b',
  gamepad: '#0ea5e9', sparkles: '#caa500', trophy: '#ff9500', fire: '#ff7a4d',
  gift: '#22c55e',
};

export function greetingForNow(now = new Date()): string {
  const h = now.getHours();
  if (h < 10) return 'God morgon';
  if (h < 18) return 'God dag';
  return 'God kväll';
}

/** Swedish thousands formatting, e.g. 1240 -> "1 240". */
export function fmt(n: number): string {
  return n.toLocaleString('sv-SE');
}

export function relativeDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'nu';
  if (min < 60) return `${min} min sedan`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} tim sedan`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Igår';
  if (days < 7) return `${days} dagar sedan`;
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

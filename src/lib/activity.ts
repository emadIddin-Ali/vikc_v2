import type { Activity } from '@/lib/types';

/** Hur långt före starten en aktivitet öppnar för incheckning. */
const FORE_START_MIN = 15;

/**
 * Pågår aktiviteten just nu?
 *
 * Samma fönster som `youth_open_activities` i databasen (0019/0025), så
 * ledarens lista och ungdomens lista säger samma sak: löpande aktiviteter är
 * alltid öppna, ett evenemang öppnar 15 minuter före start och stänger när
 * incheckningstiden tagit slut.
 *
 * Saknas starttid eller längd räknas den som öppen — annars hade en aktivitet
 * utan sluttid försvunnit direkt, och det är inte vad ledaren menade när hen
 * lämnade fältet tomt.
 */
export function isActivityOpenNow(a: Activity, now: number = Date.now()): boolean {
  if (!a.active) return false;
  if (a.continuous) return true;
  if (!a.starts_at || a.duration_min == null) return true;

  const start = new Date(a.starts_at).getTime();
  return now >= start - FORE_START_MIN * 60_000 && now <= start + a.duration_min * 60_000;
}

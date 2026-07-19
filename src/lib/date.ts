const DAYS_SHORT = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];
const DAYS_LONG = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

const pad = (n: number) => String(n).padStart(2, '0');

export function fmtDateTime(d: Date): string {
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** "Idag" / "Imorgon" / "onsdag 23 jul". */
export function dayHeading(d: Date, now = new Date()): string {
  const k = dateKey(d);
  if (k === dateKey(now)) return 'Idag';
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (k === dateKey(tomorrow)) return 'Imorgon';
  return `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

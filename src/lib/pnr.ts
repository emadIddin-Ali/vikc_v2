/** Format a stored personnummer (digits only) for display: ÅÅÅÅMMDD-XXXX or ÅÅMMDD-XXXX. */
export function formatPnr(pnr: string | null | undefined): string {
  if (!pnr) return '—';
  const d = pnr.replace(/\D/g, '');
  if (d.length === 12) return `${d.slice(0, 8)}-${d.slice(8)}`;
  if (d.length === 10) return `${d.slice(0, 6)}-${d.slice(6)}`;
  return pnr;
}

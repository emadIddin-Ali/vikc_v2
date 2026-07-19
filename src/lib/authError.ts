/** Map common Supabase auth errors to friendly Swedish copy. */
export function authError(msg?: string): string {
  if (!msg) return 'Något gick fel. Försök igen.';
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'Fel e-post eller lösenord.';
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'E-posten är redan registrerad.';
  }
  if (m.includes('password should be at least')) return 'Lösenordet är för kort (minst 6 tecken).';
  if (m.includes('unable to validate email')) return 'Ogiltig e-postadress.';
  if (m.includes('email not confirmed')) return 'Bekräfta din e-post först (kolla mejlen).';
  if (m.includes('ogiltig föreningskod')) return 'Ogiltig föreningskod.';
  return msg;
}

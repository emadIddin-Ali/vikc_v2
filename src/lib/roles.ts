/** Swedish label for a membership role. Used wherever a role is shown to a member. */
export function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case 'ledare': return 'Ledare';
    case 'foralder': return 'Förälder';
    case 'larare': return 'Lärare';
    case 'kommun': return 'Kommun';
    default: return 'Ungdom';
  }
}

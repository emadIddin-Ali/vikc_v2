/**
 * The line on the home level card.
 *
 * It used to be the hardcoded string "Nice svit — fortsätt så!", which the app
 * showed to everyone — including a member who had never checked in and had no
 * streak at all. Praise you didn't earn is the fastest way to lose a teenager,
 * and this is the largest type on the screen. So the copy is derived from real
 * state, and every branch below is true when it shows.
 */

export type HomeState = {
  visits: number;
  streak: number;
  checkedInToday: boolean;
};

export type HomePep = {
  /** Headline on the card. */
  line: string;
  /** One supporting line. Says what happens next, never how it went. */
  hint: string;
  /** Label for the card's action, or null when there is nothing to do now. */
  action: string | null;
};

export function homePep({ visits, streak, checkedInToday }: HomeState): HomePep {
  if (visits === 0) {
    return {
      line: 'Första incheckningen',
      hint: 'Skanna QR-koden på gården så börjar du samla poäng.',
      action: 'Visa hur',
    };
  }

  if (checkedInToday) {
    return streak >= 2
      ? {
          line: `${streak} dagar i rad`,
          hint: 'Kom tillbaka imorgon så växer sviten.',
          action: null,
        }
      : {
          line: 'Incheckad idag',
          hint: 'Kom tillbaka imorgon så blir det 2 i rad.',
          action: null,
        };
  }

  if (streak >= 1) {
    return {
      line: 'Sviten lever',
      hint: `${streak} ${streak === 1 ? 'dag' : 'dagar'} i rad. Checka in idag så blir det ${streak + 1}.`,
      action: 'Checka in',
    };
  }

  return {
    line: 'Inte här idag',
    hint: 'Checka in på gården för poäng och XP.',
    action: 'Checka in',
  };
}

/** True when the most recent check-in happened today. */
export function isToday(iso: string | undefined, now = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

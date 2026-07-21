import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Refetch when the screen comes back into focus.
 *
 * The youth screens sit in a Tabs navigator, so once visited they stay mounted
 * for the rest of the session. `refetchOnMount` therefore fires exactly once,
 * and anything the server changed afterwards — a new notification, someone
 * overtaking you on the leaderboard — never arrives. Skips the first focus,
 * which the query's own initial fetch already covers.
 */
export function useRefreshOnFocus(refetch: () => void): void {
  const first = useRef(true);

  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      refetch();
    }, [refetch]),
  );
}

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { invalidateMemberData } from '@/lib/queries';
import { useAuth } from '@/providers/AuthProvider';

/**
 * Pull-to-refresh for any screen: refetches the member's data and reloads the
 * auth context.
 *
 * The context reload matters — the förening's theme, name and geofence live
 * there, not in a query, so without it a theme a ledare just picked would not
 * appear until the next sign-in.
 */
export function useRefreshAll(): { refreshing: boolean; onRefresh: () => void } {
  const qc = useQueryClient();
  const { refresh } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([refresh(), qc.refetchQueries({ type: 'active' })])
      .catch(() => {
        // Nothing to tell the member here — the old data stays on screen.
      })
      .finally(() => {
        invalidateMemberData(qc);
        setRefreshing(false);
      });
  }, [qc, refresh]);

  return { refreshing, onRefresh };
}

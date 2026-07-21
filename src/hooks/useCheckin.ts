import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateMemberData } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import type { CheckinResult, YouthOpenActivity } from '@/lib/types';

export type CheckinVars = { token: string; lat: number | null; lng: number | null; accuracy: number | null };

/** QR check-in (server validates QR + geofence + time window + daily limit). */
export function useCheckin() {
  const qc = useQueryClient();
  return useMutation<CheckinResult, Error, CheckinVars>({
    mutationFn: async ({ token, lat, lng, accuracy }) => {
      const { data, error } = await supabase.rpc('check_in', {
        p_qr_token: token,
        p_lat: lat,
        p_lng: lng,
        p_accuracy: accuracy,
      });
      if (error) throw new Error(error.message);
      return data as CheckinResult;
    },
    onSuccess: () => invalidateMemberData(qc),
  });
}

export type OpenCheckinVars = {
  activityId: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  photoUrl: string | null;
};

/** Open (no-QR) check-in — server enforces geofence + photo + daily limit. */
export function useOpenCheckin() {
  const qc = useQueryClient();
  return useMutation<CheckinResult, Error, OpenCheckinVars>({
    mutationFn: async ({ activityId, lat, lng, accuracy, photoUrl }) => {
      const { data, error } = await supabase.rpc('open_checkin', {
        p_activity: activityId,
        p_lat: lat,
        p_lng: lng,
        p_accuracy: accuracy,
        p_photo_url: photoUrl,
      });
      if (error) throw new Error(error.message);
      return data as CheckinResult;
    },
    onSuccess: () => invalidateMemberData(qc),
  });
}

/** Open activities the youth can still check into right now (hides completed ones). */
export function useYouthOpenActivities(foreningId: string | null) {
  return useQuery<YouthOpenActivity[]>({
    queryKey: ['open-activities', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('youth_open_activities', { p_forening: foreningId });
      if (error) throw new Error(error.message);
      return (data as YouthOpenActivity[]) ?? [];
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Activity, LedareCheckin, LedareOverview, LedareYouth, Mission, Reward } from '@/lib/types';
import { toast } from '@/store/toast';

/** KPI numbers for the leader overview. */
export function useLedareOverview(foreningId: string | null) {
  return useQuery<LedareOverview>({
    queryKey: ['ledare-overview', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ledare_overview', { p_forening: foreningId });
      if (error) throw new Error(error.message);
      return data as LedareOverview;
    },
  });
}

export function useLedareActivities(foreningId: string | null) {
  return useQuery<Activity[]>({
    queryKey: ['ledare-activities', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity')
        .select('*')
        .eq('forening_id', foreningId as string)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as Activity[]) ?? [];
    },
  });
}

export type PublishVars = {
  forening: string;
  title: string;
  when: string;
  points: number;
  place: string;
  theme: string;
  lat: number | null;
  lng: number | null;
  startsAt: string | null;
  continuous: boolean;
  checkinMode: 'qr' | 'open';
  requiresPhoto: boolean;
  durationMin: number | null;
  dailyLimit: number;
  radiusM: number | null;
};

export function usePublishActivity() {
  const qc = useQueryClient();
  return useMutation<Activity, Error, PublishVars>({
    mutationFn: async (v) => {
      const { data, error } = await supabase.rpc('publish_activity', {
        p_forening: v.forening,
        p_title: v.title,
        p_when: v.when,
        p_points: v.points,
        p_place: v.place,
        p_theme: v.theme,
        p_lat: v.lat,
        p_lng: v.lng,
        p_starts_at: v.startsAt,
        p_continuous: v.continuous,
        p_checkin_mode: v.checkinMode,
        p_requires_photo: v.requiresPhoto,
        p_duration_min: v.durationMin,
        p_daily_limit: v.dailyLimit,
        p_radius_m: v.radiusM,
      });
      if (error) throw new Error(error.message);
      return data as Activity;
    },
    onSuccess: () => {
      toast('Aktivitet upplagd');
      qc.invalidateQueries({ queryKey: ['ledare-activities'] });
      qc.invalidateQueries({ queryKey: ['ledare-overview'] });
    },
    onError: (e) => toast(e.message),
  });
}

export function useLedareYouth(foreningId: string | null, activityId: string | null = null) {
  return useQuery<LedareYouth[]>({
    queryKey: ['ledare-youth', foreningId, activityId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ledare_youth', { p_forening: foreningId, p_activity: activityId });
      if (error) throw new Error(error.message);
      return (data as LedareYouth[]) ?? [];
    },
  });
}

export function useLedareCheckinsToday(foreningId: string | null) {
  return useQuery<LedareCheckin[]>({
    queryKey: ['ledare-checkins-today', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ledare_checkins_today', { p_forening: foreningId });
      if (error) throw new Error(error.message);
      return (data as LedareCheckin[]) ?? [];
    },
  });
}

/** Recent check-ins across days (who has been active), with optional proof photo. */
export function useLedareRecentCheckins(foreningId: string | null) {
  return useQuery<LedareCheckin[]>({
    queryKey: ['ledare-recent', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ledare_recent_checkins', { p_forening: foreningId, p_limit: 40 });
      if (error) throw new Error(error.message);
      return (data as LedareCheckin[]) ?? [];
    },
  });
}

export function useMarkPresent() {
  const qc = useQueryClient();
  return useMutation<{ awarded: number }, Error, { forening: string; user: string; name: string; activityId: string | null }>({
    mutationFn: async ({ forening, user, activityId }) => {
      const { data, error } = await supabase.rpc('mark_present', { p_forening: forening, p_user: user, p_activity: activityId });
      if (error) throw new Error(error.message);
      return data as { awarded: number };
    },
    onSuccess: (data, vars) => {
      toast(`${vars.name.split(' ')[0]} incheckad · +${data.awarded}p`);
      qc.invalidateQueries({ queryKey: ['ledare-youth'] });
      qc.invalidateQueries({ queryKey: ['ledare-overview'] });
      qc.invalidateQueries({ queryKey: ['ledare-checkins-today'] });
    },
    onError: (e) => toast(e.message),
  });
}

export function useLedareRewards(foreningId: string | null) {
  return useQuery<Reward[]>({
    queryKey: ['ledare-rewards', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reward')
        .select('*')
        .eq('forening_id', foreningId as string)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data as Reward[]) ?? [];
    },
  });
}

export type AddRewardVars = {
  forening_id: string;
  title: string;
  icon: string;
  tint: string;
  cost: number;
};

export function useAddReward() {
  const qc = useQueryClient();
  return useMutation<void, Error, AddRewardVars>({
    mutationFn: async (v) => {
      const { error } = await supabase.from('reward').insert({
        forening_id: v.forening_id,
        title: v.title,
        icon: v.icon,
        tint: v.tint,
        cost: v.cost,
        tag: 'Ny belöning',
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Belöning tillagd');
      qc.invalidateQueries({ queryKey: ['ledare-rewards'] });
    },
    onError: (e) => toast(e.message),
  });
}

export function useLedareMissions(foreningId: string | null) {
  return useQuery<Mission[]>({
    queryKey: ['ledare-missions', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('mission')
        .select('*')
        .eq('forening_id', foreningId as string)
        .order('sort', { ascending: true });
      if (error) throw new Error(error.message);
      return (data as Mission[]) ?? [];
    },
  });
}

export type NewMission = {
  forening_id: string;
  title: string;
  description: string;
  icon: string;
  tint: string;
  goal: number;
  xp: number;
  auto_visit: boolean;
};

export function useCreateMission() {
  const qc = useQueryClient();
  return useMutation<void, Error, NewMission>({
    mutationFn: async (v) => {
      const { error } = await supabase.from('mission').insert(v);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Uppdrag skapat');
      qc.invalidateQueries({ queryKey: ['ledare-missions'] });
      qc.invalidateQueries({ queryKey: ['missions'] });
    },
    onError: (e) => toast(e.message),
  });
}

export function useSetForeningLocation() {
  const qc = useQueryClient();
  return useMutation<void, Error, { forening: string; lat: number; lng: number; radius: number | null }>({
    mutationFn: async (v) => {
      const { error } = await supabase.rpc('set_forening_location', {
        p_forening: v.forening,
        p_lat: v.lat,
        p_lng: v.lng,
        p_radius: v.radius,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Föreningens plats sparad');
      qc.invalidateQueries({ queryKey: ['open-activities'] });
    },
    onError: (e) => toast(e.message),
  });
}

export function useUpdateActivity() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; patch: Record<string, unknown> }>({
    mutationFn: async ({ id, patch }) => {
      const { error } = await supabase.from('activity').update(patch).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Aktivitet uppdaterad');
      qc.invalidateQueries({ queryKey: ['ledare-activities'] });
      qc.invalidateQueries({ queryKey: ['home'] });
      qc.invalidateQueries({ queryKey: ['open-activities'] });
      qc.invalidateQueries({ queryKey: ['scan-activities'] });
    },
    onError: (e) => toast(e.message),
  });
}

export function useDeleteActivity() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('activity').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Aktivitet borttagen');
      qc.invalidateQueries({ queryKey: ['ledare-activities'] });
      qc.invalidateQueries({ queryKey: ['home'] });
      qc.invalidateQueries({ queryKey: ['open-activities'] });
      qc.invalidateQueries({ queryKey: ['scan-activities'] });
    },
    onError: (e) => toast(e.message),
  });
}

export function useUpdateMission() {
  const qc = useQueryClient();
  return useMutation<void, Error, { id: string; patch: Record<string, unknown> }>({
    mutationFn: async ({ id, patch }) => {
      const { error } = await supabase.from('mission').update(patch).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Uppdrag uppdaterat');
      qc.invalidateQueries({ queryKey: ['ledare-missions'] });
      qc.invalidateQueries({ queryKey: ['missions'] });
    },
    onError: (e) => toast(e.message),
  });
}

export function useDeleteMission() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from('mission').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Uppdrag borttaget');
      qc.invalidateQueries({ queryKey: ['ledare-missions'] });
      qc.invalidateQueries({ queryKey: ['missions'] });
    },
    onError: (e) => toast(e.message),
  });
}

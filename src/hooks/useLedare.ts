import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { signCheckinPhoto } from '@/lib/photo';
import type {
  Activity, Forening, LedareCheckin, LedareMarknad, LedareOverview, LedareReward, LedareYouth,
  Mission, MissionKind, RewardAvailability,
} from '@/lib/types';
import { useAuth } from '@/providers/AuthProvider';
import { toast } from '@/store/toast';
import type { AppThemeId } from '@/theme/tokens';

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
  requiresCheckout: boolean;
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
        p_requires_checkout: v.requiresCheckout,
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
      const rows = (data as LedareCheckin[]) ?? [];
      // Photos live in a private bucket — turn each stored path into a short-lived
      // signed URL the leader can actually load.
      return Promise.all(
        rows.map(async (r) =>
          r.photo_url ? { ...r, photo_url: await signCheckinPhoto(r.photo_url) } : r,
        ),
      );
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
  return useQuery<LedareReward[]>({
    queryKey: ['ledare-rewards', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      // Function, not a select: the leader needs the claimed count per reward.
      const { data, error } = await supabase.rpc('ledare_rewards', { p_forening: foreningId });
      if (error) throw new Error(error.message);
      return (data as LedareReward[]) ?? [];
    },
  });
}

/** Change how many of a reward can still be handed out. null = unlimited. */
export function useSetRewardStock() {
  const qc = useQueryClient();
  return useMutation<void, Error, { reward: string; stock: number | null }>({
    mutationFn: async (v) => {
      const { error } = await supabase.rpc('set_reward_stock', { p_reward: v.reward, p_stock: v.stock });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Antalet sparat');
      qc.invalidateQueries({ queryKey: ['ledare-rewards'] });
      qc.invalidateQueries({ queryKey: ['shop'] });
    },
    onError: (e) => toast(e.message),
  });
}

/**
 * Give the förening a new join code. Memberships hang off forening_id, not the
 * code, so nobody loses their place — this is the way out when a code has been
 * passed around beyond the people it was meant for.
 */
export function useRotateJoinCode() {
  const qc = useQueryClient();
  const { refresh } = useAuth();
  return useMutation<string, Error, string>({
    mutationFn: async (forening) => {
      const { data, error } = await supabase.rpc('rotate_join_code', { p_forening: forening });
      if (error) throw new Error(error.message);
      return data as string;
    },
    onSuccess: async (kod) => {
      toast(`Ny föreningskod: ${kod}`);
      await refresh();
      qc.invalidateQueries({ queryKey: ['forening'] });
      qc.invalidateQueries({ queryKey: ['kommun-overview'] });
    },
    onError: (e) => toast(e.message),
  });
}

/** Hand a class to another teacher — the way to rescue one whose teacher left. */
export function useTilldelaKlass() {
  const qc = useQueryClient();
  return useMutation<void, Error, { klass: string; larare: string }>({
    mutationFn: async (v) => {
      const { error } = await supabase.rpc('tilldela_klass', { p_klass: v.klass, p_larare: v.larare });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Klassen har fått en ny lärare');
      qc.invalidateQueries({ queryKey: ['ledare-klasser'] });
      qc.invalidateQueries({ queryKey: ['ledare-larare'] });
      qc.invalidateQueries({ queryKey: ['larare-klasser'] });
    },
    onError: (e) => toast(e.message),
  });
}

/** Visits per week that earn the weekly bonus, and what it pays (ledare only). */
export function useSetForeningWeekGoal() {
  const qc = useQueryClient();
  const { refresh } = useAuth();
  return useMutation<void, Error, { forening: string; goal: number; xp: number; points: number }>({
    mutationFn: async (v) => {
      const { error } = await supabase.rpc('set_forening_week_goal', {
        p_forening: v.forening, p_goal: v.goal, p_xp: v.xp, p_points: v.points,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast('Veckomålet är sparat');
      await refresh();
      qc.invalidateQueries({ queryKey: ['forening'] });
      qc.invalidateQueries({ queryKey: ['min-vecka'] });
    },
    onError: (e) => toast(e.message),
  });
}

/** The förening's scheduled markets (ledare only). */
export function useLedareMarknader(foreningId: string | null) {
  return useQuery<LedareMarknad[]>({
    queryKey: ['ledare-marknader', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ledare_marknader', { p_forening: foreningId });
      if (error) throw new Error(error.message);
      return (data as LedareMarknad[]) ?? [];
    },
  });
}

function invalidateShop(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['ledare-marknader'] });
  qc.invalidateQueries({ queryKey: ['ledare-rewards'] });
  qc.invalidateQueries({ queryKey: ['shop'] });
}

export function useSaveMarknad() {
  const qc = useQueryClient();
  return useMutation<void, Error, { forening: string; name: string; opensAt: string; closesAt: string; id?: string | null }>({
    mutationFn: async (v) => {
      const { error } = await supabase.rpc('save_marknad', {
        p_forening: v.forening,
        p_opens: v.opensAt,
        p_closes: v.closesAt,
        p_name: v.name,
        p_id: v.id ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Marknaden är sparad');
      invalidateShop(qc);
    },
    onError: (e) => toast(e.message),
  });
}

export function useDeleteMarknad() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.rpc('delete_marknad', { p_id: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Marknaden är borttagen');
      invalidateShop(qc);
    },
    onError: (e) => toast(e.message),
  });
}

/** When a reward can be bought, and how many times per member. */
export function useSetRewardAvailability() {
  const qc = useQueryClient();
  return useMutation<void, Error, { reward: string; availability: RewardAvailability; limit: number | null }>({
    mutationFn: async (v) => {
      const { error } = await supabase.rpc('set_reward_availability', {
        p_reward: v.reward,
        p_availability: v.availability,
        p_limit: v.limit,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => invalidateShop(qc),
    onError: (e) => toast(e.message),
  });
}

export type AddRewardVars = {
  forening_id: string;
  title: string;
  icon: string;
  tint: string;
  cost: number;
  /** How many can be handed out. null = unlimited. */
  stock: number | null;
  availability: RewardAvailability;
  /** How many times one member may take it. null = unlimited. */
  limit_per_member: number | null;
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
        stock: v.stock,
        availability: v.availability,
        limit_per_member: v.limit_per_member,
        tag: null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Belöning tillagd');
      invalidateShop(qc);
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
  kind: MissionKind;
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

/** Set the förening's brand theme. Only affects this förening's members. */
export function useSetForeningTheme() {
  const qc = useQueryClient();
  const { refresh } = useAuth();
  return useMutation<void, Error, { forening: string; theme: AppThemeId }>({
    mutationFn: async (v) => {
      const { error } = await supabase.rpc('set_forening_theme', {
        p_forening: v.forening,
        p_theme: v.theme,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast('Temat sparat');
      // The gradient is read from the förening on the auth context, not from a
      // query — so the context has to be reloaded for the app to repaint.
      await refresh();
      qc.invalidateQueries({ queryKey: ['ledare-overview'] });
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

/** Read one förening fresh (all columns), so the Förening tab edits live data. */
export function useForening(foreningId: string | null) {
  return useQuery<Forening | null>({
    queryKey: ['forening', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase.from('forening').select('*').eq('id', foreningId as string).maybeSingle();
      if (error) throw new Error(error.message);
      return (data as Forening) ?? null;
    },
  });
}

export type ForeningInfoVars = {
  forening: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  openingHours: string;
  logoUrl: string | null;
};

/** Save the förening's public info + logo (ledare only). Shared across all its ledare. */
export function useUpdateForeningInfo() {
  const qc = useQueryClient();
  const { refresh } = useAuth();
  return useMutation<void, Error, ForeningInfoVars>({
    mutationFn: async (v) => {
      const { error } = await supabase.rpc('update_forening_info', {
        p_forening: v.forening,
        p_name: v.name,
        p_description: v.description,
        p_address: v.address,
        p_phone: v.phone,
        p_email: v.email,
        p_opening_hours: v.openingHours,
        p_logo_url: v.logoUrl,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      toast('Föreningsinfo sparad');
      // The logo/name are read off the auth context (for the youth header), so
      // reload it; also refresh the fresh-forening query the tab reads from.
      await refresh();
      qc.invalidateQueries({ queryKey: ['forening'] });
      qc.invalidateQueries({ queryKey: ['kommun-overview'] });
    },
    onError: (e) => toast(e.message),
  });
}

/** Toggle whether the förening requires a personnummer to join (ledare only). */
export function useSetForeningRequirePnr() {
  const qc = useQueryClient();
  const { refresh } = useAuth();
  return useMutation<void, Error, { forening: string; require: boolean }>({
    mutationFn: async (v) => {
      const { error } = await supabase.rpc('set_forening_require_personnummer', {
        p_forening: v.forening,
        p_require: v.require,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await refresh();
      qc.invalidateQueries({ queryKey: ['forening'] });
    },
    onError: (e) => toast(e.message),
  });
}

export type RegisterRow = {
  kind: string;
  name: string;
  role: string;
  personnummer: string | null;
  birth_year: number | null;
};

/** The förening's member/child register with personnummer (ledare only). */
export function useLedareRegister(foreningId: string | null) {
  return useQuery<RegisterRow[]>({
    queryKey: ['register', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ledare_register', { p_forening: foreningId });
      if (error) throw new Error(error.message);
      return (data as RegisterRow[]) ?? [];
    },
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

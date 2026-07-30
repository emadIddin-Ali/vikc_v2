import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CheckinResult, Child, ChildCheckin } from '@/lib/types';
import { toast } from '@/store/toast';

/** The caller's children in one förening, with stats. */
export function useMyChildren(foreningId: string | null) {
  return useQuery<Child[]>({
    queryKey: ['children', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_children', { p_forening: foreningId });
      if (error) throw new Error(error.message);
      return (data as Child[]) ?? [];
    },
  });
}

export function useAddChild() {
  const qc = useQueryClient();
  return useMutation<Child, Error, { forening: string; name: string; birthYear: number | null; color?: string; personnummer?: string | null }>({
    mutationFn: async (v) => {
      const { data, error } = await supabase.rpc('add_child', {
        p_forening: v.forening,
        p_name: v.name,
        p_birth_year: v.birthYear,
        p_color: v.color ?? '#6c4cf1',
        p_personnummer: v.personnummer ?? null,
      });
      if (error) throw new Error(error.message);
      return data as Child;
    },
    onSuccess: () => {
      toast('Barn tillagt');
      qc.invalidateQueries({ queryKey: ['children'] });
    },
    onError: (e) => toast(e.message),
  });
}

export function useUpdateChild() {
  const qc = useQueryClient();
  return useMutation<Child, Error, { child: string; name: string; birthYear: number | null; color?: string; personnummer?: string | null }>({
    mutationFn: async (v) => {
      const { data, error } = await supabase.rpc('update_child', {
        p_child: v.child,
        p_name: v.name,
        p_birth_year: v.birthYear,
        p_color: v.color ?? null,
        p_personnummer: v.personnummer ?? null,
      });
      if (error) throw new Error(error.message);
      return data as Child;
    },
    onSuccess: () => {
      toast('Sparat');
      qc.invalidateQueries({ queryKey: ['children'] });
    },
    onError: (e) => toast(e.message),
  });
}

export function useRemoveChild() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (childId) => {
      const { error } = await supabase.rpc('remove_child', { p_child: childId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Barn borttaget');
      qc.invalidateQueries({ queryKey: ['children'] });
    },
    onError: (e) => toast(e.message),
  });
}

/** One child's check-in history. */
export function useChildCheckins(childId: string | null) {
  return useQuery<ChildCheckin[]>({
    queryKey: ['child-checkins', childId],
    enabled: !!childId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('child_checkins', { p_child: childId });
      if (error) throw new Error(error.message);
      return (data as ChildCheckin[]) ?? [];
    },
  });
}

/** What a child has bought — the receipt a parent shows at the marknad. */
export function useChildRedemptions(childId: string | null) {
  return useQuery<{ id: string; title: string; cost: number; created_at: string }[]>({
    queryKey: ['child-redemptions', childId],
    enabled: !!childId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('child_redemptions', { p_child: childId });
      if (error) throw new Error(error.message);
      return (data as { id: string; title: string; cost: number; created_at: string }[]) ?? [];
    },
  });
}

function invalidateChildData(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['children'] });
  qc.invalidateQueries({ queryKey: ['child-checkins'] });
  qc.invalidateQueries({ queryKey: ['leaderboard'] });
}

export type ChildCheckinVars = { childId: string; token: string; lat: number | null; lng: number | null; accuracy: number | null };

/** QR check-in for a child (server verifies geo + credits the child). */
export function useCheckInChild() {
  const qc = useQueryClient();
  return useMutation<CheckinResult, Error, ChildCheckinVars>({
    mutationFn: async ({ childId, token, lat, lng, accuracy }) => {
      const { data, error } = await supabase.rpc('check_in_child', {
        p_child: childId, p_qr_token: token, p_lat: lat, p_lng: lng, p_accuracy: accuracy,
      });
      if (error) throw new Error(error.message);
      return data as CheckinResult;
    },
    onSuccess: () => invalidateChildData(qc),
  });
}

export type OpenChildCheckinVars = { childId: string; activityId: string; lat: number | null; lng: number | null; accuracy: number | null; photoUrl: string | null };

/** Open (no-QR) check-in for a child. */
export function useOpenCheckinChild() {
  const qc = useQueryClient();
  return useMutation<CheckinResult, Error, OpenChildCheckinVars>({
    mutationFn: async ({ childId, activityId, lat, lng, accuracy, photoUrl }) => {
      const { data, error } = await supabase.rpc('open_checkin_child', {
        p_child: childId, p_activity: activityId, p_lat: lat, p_lng: lng, p_accuracy: accuracy, p_photo_url: photoUrl,
      });
      if (error) throw new Error(error.message);
      return data as CheckinResult;
    },
    onSuccess: () => invalidateChildData(qc),
  });
}

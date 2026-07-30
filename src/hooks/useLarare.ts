import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { invalidateMemberData } from '@/lib/queries';
import type {
  ElevKlass, ElevStjarna, ForeningElev, KlassElev, KlassToppRad, LarareKlass, LarareRad,
  LedareKlass, Lektion, LektionMedKlass, LektionRad, LektionResultat, NarvaroStatus, StarCategory,
} from '@/lib/types';
import { toast } from '@/store/toast';

/** Everything that changes when a lesson is closed or a star is undone. */
function invalidateKlassData(qc: ReturnType<typeof useQueryClient>) {
  for (const key of ['larare-klasser', 'ledare-klasser', 'klass-elever', 'lektion', 'lektion-lista',
    'elev-klasser', 'elev-stjarnor', 'klass-topp', 'ledare-larare']) {
    qc.invalidateQueries({ queryKey: [key] });
  }
  // Stars move XP, level and (optionally) points, so the member's own views are
  // stale too — the same set a check-in invalidates.
  invalidateMemberData(qc);
}

/* ------------------------------------------------------------------ *
 * Lärarens klasser
 * ------------------------------------------------------------------ */

export function useLarareKlasser(foreningId: string | null) {
  return useQuery<LarareKlass[]>({
    queryKey: ['larare-klasser', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('larare_klasser', { p_forening: foreningId });
      if (error) throw new Error(error.message);
      return (data as LarareKlass[]) ?? [];
    },
  });
}

export type KlassVars = {
  name: string;
  description: string | null;
  weekday: number | null;
  timeText: string | null;
  color: string;
};

export function useCreateKlass() {
  const qc = useQueryClient();
  return useMutation<void, Error, KlassVars & { forening: string }>({
    mutationFn: async (v) => {
      const { error } = await supabase.rpc('create_klass', {
        p_forening: v.forening,
        p_name: v.name,
        p_description: v.description,
        p_weekday: v.weekday,
        p_time_text: v.timeText,
        p_color: v.color,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Klassen är skapad');
      qc.invalidateQueries({ queryKey: ['larare-klasser'] });
      qc.invalidateQueries({ queryKey: ['ledare-klasser'] });
    },
    onError: (e) => toast(e.message),
  });
}

export function useUpdateKlass() {
  const qc = useQueryClient();
  return useMutation<void, Error, KlassVars & { klass: string }>({
    mutationFn: async (v) => {
      const { error } = await supabase.rpc('update_klass', {
        p_klass: v.klass,
        p_name: v.name,
        p_description: v.description,
        p_weekday: v.weekday,
        p_time_text: v.timeText,
        p_color: v.color,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Sparat');
      qc.invalidateQueries({ queryKey: ['larare-klasser'] });
      qc.invalidateQueries({ queryKey: ['ledare-klasser'] });
    },
    onError: (e) => toast(e.message),
  });
}

export function useArchiveKlass() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (klassId) => {
      const { error } = await supabase.rpc('archive_klass', { p_klass: klassId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Klassen är arkiverad');
      qc.invalidateQueries({ queryKey: ['larare-klasser'] });
      qc.invalidateQueries({ queryKey: ['ledare-klasser'] });
    },
    onError: (e) => toast(e.message),
  });
}

/* ------------------------------------------------------------------ *
 * Elever i klassen + adoptera ur föreningen
 * ------------------------------------------------------------------ */

export function useKlassElever(klassId: string | null) {
  return useQuery<KlassElev[]>({
    queryKey: ['klass-elever', klassId],
    enabled: !!klassId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('klass_elever', { p_klass: klassId });
      if (error) throw new Error(error.message);
      return (data as KlassElev[]) ?? [];
    },
  });
}

/**
 * The förening roster a teacher manages a class from. Name + avatar only.
 * Pass the class to get each row's membership in it, so one list can both
 * add and remove.
 */
export function useForeningElever(foreningId: string | null, query: string, klassId: string | null = null) {
  return useQuery<ForeningElev[]>({
    queryKey: ['forening-elever', foreningId, query, klassId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('forening_elever', {
        p_forening: foreningId,
        p_query: query.trim() || null,
        p_klass: klassId,
      });
      if (error) throw new Error(error.message);
      return (data as ForeningElev[]) ?? [];
    },
  });
}

export function useAddKlassElev() {
  const qc = useQueryClient();
  return useMutation<void, Error, { klass: string; userId: string | null; childId: string | null; name: string }>({
    mutationFn: async (v) => {
      const { error } = await supabase.rpc('add_klass_elev', {
        p_klass: v.klass,
        p_user: v.userId,
        p_child: v.childId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, v) => {
      toast(`${v.name.split(' ')[0]} tillagd`);
      qc.invalidateQueries({ queryKey: ['klass-elever'] });
      qc.invalidateQueries({ queryKey: ['forening-elever'] });
      qc.invalidateQueries({ queryKey: ['larare-klasser'] });
    },
    onError: (e) => toast(e.message),
  });
}

export function useRemoveKlassElev() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.rpc('remove_klass_elev', { p_klass_elev: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Eleven togs bort ur klassen');
      qc.invalidateQueries({ queryKey: ['klass-elever'] });
      qc.invalidateQueries({ queryKey: ['forening-elever'] });
      qc.invalidateQueries({ queryKey: ['larare-klasser'] });
    },
    onError: (e) => toast(e.message),
  });
}

/** "Det stämmer inte" — the student or the child's parent undoes a placement. */
export function useNekaKlassplacering() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.rpc('neka_klassplacering', { p_klass_elev: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Placeringen är borttagen');
      qc.invalidateQueries({ queryKey: ['elev-klasser'] });
    },
    onError: (e) => toast(e.message),
  });
}

export function useJoinKlassByCode() {
  const qc = useQueryClient();
  return useMutation<void, Error, { code: string; childId: string | null }>({
    mutationFn: async (v) => {
      const { error } = await supabase.rpc('join_klass_by_code', {
        p_code: v.code,
        p_child: v.childId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Du är med i klassen');
      qc.invalidateQueries({ queryKey: ['elev-klasser'] });
    },
    onError: (e) => toast(e.message),
  });
}

/* ------------------------------------------------------------------ *
 * Lektionen
 * ------------------------------------------------------------------ */

export function useStartLektion() {
  const qc = useQueryClient();
  return useMutation<Lektion, Error, { klass: string; datum?: string | null }>({
    mutationFn: async (v) => {
      const { data, error } = await supabase.rpc('start_lektion', {
        p_klass: v.klass,
        p_datum: v.datum ?? null,
      });
      if (error) throw new Error(error.message);
      return data as Lektion;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['larare-klasser'] });
    },
    onError: (e) => toast(e.message),
  });
}

/** The lesson row itself (date, class name, whether it is closed). */
export function useLektion(lektionId: string | null) {
  return useQuery<LektionMedKlass | null>({
    queryKey: ['lektion', lektionId],
    enabled: !!lektionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lektion')
        .select('*, klass:klass_id(name, color)')
        .eq('id', lektionId as string)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as LektionMedKlass) ?? null;
    },
  });
}

export function useLektionLista(lektionId: string | null) {
  return useQuery<LektionRad[]>({
    queryKey: ['lektion-lista', lektionId],
    enabled: !!lektionId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('lektion_lista', { p_lektion: lektionId });
      if (error) throw new Error(error.message);
      return (data as LektionRad[]) ?? [];
    },
  });
}

/**
 * Attendance and stars are tapped dozens of times per lesson, so both write
 * optimistically — waiting for a round trip per tap made the list feel stuck.
 */
type ListCtx = { prev?: LektionRad[] };

function patchRad(
  qc: ReturnType<typeof useQueryClient>,
  lektion: string,
  elev: string,
  patch: Partial<LektionRad>,
): ListCtx {
  const key = ['lektion-lista', lektion];
  const prev = qc.getQueryData<LektionRad[]>(key);
  qc.setQueryData<LektionRad[]>(key, (rows) =>
    (rows ?? []).map((r) => (r.klass_elev_id === elev ? { ...r, ...patch } : r)));
  return { prev };
}

export function useSetNarvaro() {
  const qc = useQueryClient();
  return useMutation<void, Error, { lektion: string; elev: string; status: NarvaroStatus }, ListCtx>({
    mutationFn: async (v) => {
      const { error } = await supabase.rpc('set_narvaro', {
        p_lektion: v.lektion,
        p_klass_elev: v.elev,
        p_status: v.status,
      });
      if (error) throw new Error(error.message);
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['lektion-lista', v.lektion] });
      return patchRad(qc, v.lektion, v.elev, { status: v.status });
    },
    onError: (e, v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['lektion-lista', v.lektion], ctx.prev);
      toast(e.message);
    },
    onSettled: (_d, _e, v) => qc.invalidateQueries({ queryKey: ['lektion-lista', v.lektion] }),
  });
}

/**
 * Set a student's stars on an open lesson. No XP moves yet — that happens on
 * avsluta_lektion, which is why the teacher can change their mind freely.
 */
export function useSattStjarnor() {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { lektion: string; elev: string; stars: number; kategori: StarCategory; note?: string | null },
    ListCtx
  >({
    mutationFn: async (v) => {
      const { error } = await supabase.rpc('satt_lektion_stjarnor', {
        p_lektion: v.lektion,
        p_klass_elev: v.elev,
        p_stars: v.stars,
        p_kategori: v.kategori,
        p_note: v.note ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['lektion-lista', v.lektion] });
      return patchRad(qc, v.lektion, v.elev, {
        stars: v.stars > 0 ? v.stars : null,
        kategori: v.stars > 0 ? v.kategori : null,
        note: v.stars > 0 ? v.note ?? null : null,
      });
    },
    onError: (e, v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['lektion-lista', v.lektion], ctx.prev);
      toast(e.message);
    },
    onSettled: (_d, _e, v) => qc.invalidateQueries({ queryKey: ['lektion-lista', v.lektion] }),
  });
}

export function useAvslutaLektion() {
  const qc = useQueryClient();
  return useMutation<LektionResultat, Error, string>({
    mutationFn: async (lektionId) => {
      const { data, error } = await supabase.rpc('avsluta_lektion', { p_lektion: lektionId });
      if (error) throw new Error(error.message);
      return data as LektionResultat;
    },
    onSuccess: (r) => {
      toast(`Lektionen är klar · ${r.narvarande} närvarande · ${r.stjarnor}★`);
      invalidateKlassData(qc);
    },
    onError: (e) => toast(e.message),
  });
}

/** A star outside a lesson (homework handed in between sessions). Pays out at once. */
export function useGeStjarna() {
  const qc = useQueryClient();
  return useMutation<{ xp: number }, Error, { elev: string; stars: number; kategori: StarCategory; note?: string | null }>({
    mutationFn: async (v) => {
      const { data, error } = await supabase.rpc('ge_stjarna', {
        p_klass_elev: v.elev,
        p_stars: v.stars,
        p_kategori: v.kategori,
        p_note: v.note ?? null,
      });
      if (error) throw new Error(error.message);
      return data as { xp: number };
    },
    onSuccess: (r) => {
      toast(`Stjärnor utdelade · +${r.xp} XP`);
      invalidateKlassData(qc);
    },
    onError: (e) => toast(e.message),
  });
}

export function useAngraStjarna() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.rpc('angra_stjarna', { p_stjarna: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Stjärnan är ångrad');
      invalidateKlassData(qc);
    },
    onError: (e) => toast(e.message),
  });
}

/* ------------------------------------------------------------------ *
 * Elevens och förälderns vy
 * ------------------------------------------------------------------ */

/** Classes the caller (or their child) is in. Pass childId for a parent view. */
export function useElevKlasser(enabled: boolean, childId: string | null = null) {
  return useQuery<ElevKlass[]>({
    queryKey: ['elev-klasser', childId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('elev_klasser', { p_user: null, p_child: childId });
      if (error) throw new Error(error.message);
      return (data as ElevKlass[]) ?? [];
    },
  });
}

/** Star history for the caller, their child, or (for a teacher) their student. */
export function useElevStjarnor(enabled: boolean, opts: { userId?: string | null; childId?: string | null } = {}) {
  const { userId = null, childId = null } = opts;
  return useQuery<ElevStjarna[]>({
    queryKey: ['elev-stjarnor', userId, childId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('elev_stjarnor', {
        p_user: userId, p_child: childId, p_limit: 40,
      });
      if (error) throw new Error(error.message);
      return (data as ElevStjarna[]) ?? [];
    },
  });
}

export function useKlassTopplista(klassId: string | null) {
  return useQuery<KlassToppRad[]>({
    queryKey: ['klass-topp', klassId],
    enabled: !!klassId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('klass_topplista', { p_klass: klassId });
      if (error) throw new Error(error.message);
      return (data as KlassToppRad[]) ?? [];
    },
  });
}

/* ------------------------------------------------------------------ *
 * Ledarens kontroll
 * ------------------------------------------------------------------ */

export function useLedareLarare(foreningId: string | null) {
  return useQuery<LarareRad[]>({
    queryKey: ['ledare-larare', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ledare_larare', { p_forening: foreningId });
      if (error) throw new Error(error.message);
      return (data as LarareRad[]) ?? [];
    },
  });
}

export function useGodkannLarare() {
  const qc = useQueryClient();
  return useMutation<void, Error, { forening: string; user: string; godkann: boolean }>({
    mutationFn: async (v) => {
      const { error } = await supabase.rpc('godkann_larare', {
        p_forening: v.forening, p_user: v.user, p_godkann: v.godkann,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, v) => {
      toast(v.godkann ? 'Läraren är godkänd' : 'Behörigheten är pausad');
      qc.invalidateQueries({ queryKey: ['ledare-larare'] });
    },
    onError: (e) => toast(e.message),
  });
}

export function useLedareKlasser(foreningId: string | null) {
  return useQuery<LedareKlass[]>({
    queryKey: ['ledare-klasser', foreningId],
    enabled: !!foreningId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ledare_klasser', { p_forening: foreningId });
      if (error) throw new Error(error.message);
      return (data as LedareKlass[]) ?? [];
    },
  });
}

export function useSetStarSettings() {
  const qc = useQueryClient();
  return useMutation<void, Error, { forening: string; starXp: number[] | null; pointsFactor: number | null; maxVecka: number | null }>({
    mutationFn: async (v) => {
      const { error } = await supabase.rpc('set_forening_star_settings', {
        p_forening: v.forening,
        p_star_xp: v.starXp,
        p_points_factor: v.pointsFactor,
        p_max_vecka: v.maxVecka,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Stjärnvärdena är sparade');
      qc.invalidateQueries({ queryKey: ['forening'] });
    },
    onError: (e) => toast(e.message),
  });
}

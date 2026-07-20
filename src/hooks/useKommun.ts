import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { KommunForening } from '@/lib/types';
import { toast } from '@/store/toast';

export function useKommunOverview() {
  return useQuery<KommunForening[]>({
    queryKey: ['kommun-overview'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('kommun_overview');
      if (error) throw new Error(error.message);
      return (data as KommunForening[]) ?? [];
    },
  });
}

export function useCreateForening() {
  const qc = useQueryClient();
  return useMutation<void, Error, { name: string; color: string }>({
    mutationFn: async ({ name, color }) => {
      const { error } = await supabase.rpc('create_forening', { p_name: name, p_color: color });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast('Förening skapad');
      qc.invalidateQueries({ queryKey: ['kommun-overview'] });
    },
    onError: (e) => toast(e.message),
  });
}

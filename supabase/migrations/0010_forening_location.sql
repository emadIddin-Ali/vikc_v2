-- =====================================================================
-- LEVLA — 0010 set the förening's real location (fixes the geofence)
-- The seed coords point at Stockholm; a leader sets the real venue here so
-- the geo-lock measures distance to the actual place.
-- =====================================================================

create or replace function public.set_forening_location(
  p_forening uuid,
  p_lat      double precision,
  p_lng      double precision,
  p_radius   int default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not private.has_forening_role(p_forening, 'ledare') then
    raise exception 'Endast ledare kan ändra föreningens plats';
  end if;
  update public.forening
     set lat = p_lat,
         lng = p_lng,
         geofence_radius_m = case when p_radius is not null then greatest(p_radius, 30)
                                  else geofence_radius_m end
   where id = p_forening;
end $$;
grant execute on function public.set_forening_location(uuid, double precision, double precision, int) to authenticated;

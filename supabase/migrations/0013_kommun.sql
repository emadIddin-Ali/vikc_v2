  -- =====================================================================
  -- LEVLA — 0013 kommun (municipal superadmin) overview
  -- A kommun-admin sees aggregated stats for ALL föreningar in their kommun
  -- (data stays per-förening; this just reads across them) and can create new
  -- föreningar. Gated: only rows in kommuns the caller administers.
  -- =====================================================================

  create or replace function public.kommun_overview()
  returns table (
    id uuid, kommun_id uuid, name text, color text, join_code text,
    lat double precision, lng double precision, geofence_radius_m int,
    youth int, activities int, checkins_today int
  ) language sql security definer set search_path = '' stable as $$
    select f.id, f.kommun_id, f.name, f.color, f.join_code, f.lat, f.lng, f.geofence_radius_m,
          (select count(*)::int from public.membership m where m.forening_id = f.id and m.role = 'ungdom'),
          (select count(*)::int from public.activity a where a.forening_id = f.id and a.active),
          (select count(*)::int from public.checkin c where c.forening_id = f.id and c.created_at::date = current_date)
      from public.forening f
    where f.kommun_id in (select ka.kommun_id from public.kommun_admin ka where ka.user_id = auth.uid())
    order by f.name;
  $$;
  grant execute on function public.kommun_overview() to authenticated;

  -- Create a new förening in the caller's kommun (with a random join code).
  create or replace function public.create_forening(p_name text, p_color text default '#6c4cf1')
  returns public.forening language plpgsql security definer set search_path = '' as $$
  declare
    k    uuid;
    f    public.forening;
    code text;
  begin
    if auth.uid() is null then raise exception 'Ej inloggad'; end if;
    select ka.kommun_id into k from public.kommun_admin ka where ka.user_id = auth.uid() limit 1;
    if k is null then raise exception 'Endast kommun-admin kan skapa föreningar'; end if;
    if coalesce(trim(p_name), '') = '' then raise exception 'Skriv ett namn'; end if;

    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    insert into public.forening (kommun_id, name, color, join_code)
    values (k, trim(p_name), coalesce(nullif(trim(p_color), ''), '#6c4cf1'), code)
    returning * into f;
    return f;
  end $$;
  grant execute on function public.create_forening(text, text) to authenticated;

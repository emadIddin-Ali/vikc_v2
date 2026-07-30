-- =====================================================================
-- LEVLA — 0025 aktiviteter går ut när de inte är kontinuerliga
--
-- Problem: en enstaka (icke-kontinuerlig) aktivitet fortsatte synas och gå
-- att checka in på i all evighet om den saknade "Incheckningstid (min)".
-- Tidfönstret krävde BÅDE starts_at OCH duration_min för att gälla.
--
-- Nu: en icke-kontinuerlig aktivitet är öppen i fönstret
--     [starts_at - 15 min , slut]
-- där slut = starts_at + duration_min  (om satt), annars slutet av startdagen.
-- Efter det går den varken att checka in på eller visas i listorna.
-- Kontinuerliga aktiviteter är alltid öppna (som förr).
--
-- Redefinierar check_in / open_checkin / check_in_child / open_checkin_child /
-- youth_open_activities. Alla säkerhetsfixar från 0024 (tvingad geofence,
-- fotovalidering) är medtagna. Kör efter 0024.
-- =====================================================================

-- ---------------------------------------------------------------------
-- check_in — QR-incheckning
-- ---------------------------------------------------------------------
create or replace function public.check_in(
  p_qr_token text, p_lat double precision default null, p_lng double precision default null,
  p_accuracy double precision default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.activity; f public.forening; m public.membership;
  v_lat double precision; v_lng double precision; dist double precision; radius int;
  award int; new_xp int; new_level int; leveled boolean := false; xp_max constant int := 1000;
  last_visit date; new_streak int; today_count int;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  select * into a from public.activity where qr_token = p_qr_token and active = true;
  if not found then raise exception 'Ogiltig eller inaktiv QR-kod'; end if;
  select * into f from public.forening where id = a.forening_id;
  select * into m from public.membership where user_id = auth.uid() and forening_id = a.forening_id;
  if not found then raise exception 'Du är inte medlem i den här föreningen'; end if;

  if a.requires_checkout and exists (
       select 1 from public.checkin c
        where c.user_id = auth.uid() and c.activity_id = a.id and c.pending = true and c.checkout_at is null
     ) then
    return public.check_out(a.id, p_lat, p_lng, p_accuracy);
  end if;

  if not a.continuous and a.starts_at is not null
     and (now() < a.starts_at - interval '15 minutes'
          or now() > coalesce(a.starts_at + make_interval(mins => a.duration_min),
                              date_trunc('day', a.starts_at) + interval '1 day')) then
    raise exception 'Incheckningen är inte öppen just nu';
  end if;

  v_lat := coalesce(a.lat, f.lat); v_lng := coalesce(a.lng, f.lng);
  radius := coalesce(a.radius_m, f.geofence_radius_m);
  if v_lat is not null and v_lng is not null then
    if p_lat is null or p_lng is null then raise exception 'Kunde inte läsa din plats'; end if;
    dist := public.distance_m(p_lat, p_lng, v_lat, v_lng);
    if dist > radius + least(coalesce(p_accuracy, 0), 60) then
      raise exception 'Du är för långt bort (% m från platsen)', round(dist)::int;
    end if;
  end if;

  select count(*) into today_count from public.checkin c
   where c.user_id = auth.uid() and c.activity_id = a.id and c.created_at::date = current_date and c.pending = false;
  if today_count >= a.daily_limit then raise exception 'Du har checkat in max antal gånger idag'; end if;
  if exists (select 1 from public.checkin c where c.user_id = auth.uid() and c.activity_id = a.id and c.created_at > now() - interval '3 minutes') then
    raise exception 'Vänta en stund innan du checkar in igen';
  end if;

  if a.requires_checkout then
    insert into public.checkin (forening_id, user_id, activity_id, title, awarded_points, awarded_xp, pending)
    values (a.forening_id, auth.uid(), a.id, a.title, 0, 0, true);
    return jsonb_build_object(
      'awarded_points', 0, 'awarded_xp', 0, 'level', m.level, 'leveled_up', false,
      'title', a.title, 'forening', f.name, 'action', 'checked_in', 'pending', true
    );
  end if;

  award := a.points;
  new_xp := m.xp + award; new_level := m.level;
  while new_xp >= xp_max loop new_xp := new_xp - xp_max; new_level := new_level + 1; leveled := true; end loop;
  select max(c.created_at::date) into last_visit from public.checkin c where c.user_id = auth.uid() and c.forening_id = a.forening_id and c.pending = false;
  if last_visit is null then new_streak := 1;
  elsif last_visit = current_date then new_streak := greatest(m.streak, 1);
  elsif last_visit = current_date - 1 then new_streak := m.streak + 1;
  else new_streak := 1; end if;

  insert into public.checkin (forening_id, user_id, activity_id, title, awarded_points, awarded_xp)
  values (a.forening_id, auth.uid(), a.id, a.title, award, award);
  insert into public.points_ledger (forening_id, user_id, delta, reason)
  values (a.forening_id, auth.uid(), award, 'checkin:' || a.id::text);
  update public.membership set xp = new_xp, level = new_level, streak = new_streak, visits = visits + 1 where id = m.id;

  return jsonb_build_object(
    'awarded_points', award, 'awarded_xp', award, 'level', new_level, 'leveled_up', leveled,
    'title', a.title, 'forening', f.name, 'action', 'checked_in', 'pending', false
  );
end $$;
grant execute on function public.check_in(text, double precision, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------
-- open_checkin — öppen incheckning (utan QR)
-- ---------------------------------------------------------------------
create or replace function public.open_checkin(
  p_activity uuid, p_lat double precision default null, p_lng double precision default null,
  p_accuracy double precision default null, p_photo_url text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.activity; f public.forening; m public.membership;
  v_lat double precision; v_lng double precision; dist double precision; radius int;
  award int; new_xp int; new_level int; leveled boolean := false; xp_max constant int := 1000;
  last_visit date; new_streak int; today_count int;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  select * into a from public.activity where id = p_activity and active = true;
  if not found then raise exception 'Aktiviteten finns inte'; end if;
  if a.checkin_mode <> 'open' then raise exception 'Den här aktiviteten kräver QR-kod'; end if;
  select * into f from public.forening where id = a.forening_id;
  select * into m from public.membership where user_id = auth.uid() and forening_id = a.forening_id;
  if not found then raise exception 'Du är inte medlem i den här föreningen'; end if;

  if a.requires_checkout and exists (
       select 1 from public.checkin c
        where c.user_id = auth.uid() and c.activity_id = a.id and c.pending = true and c.checkout_at is null
     ) then
    raise exception 'Du är redan incheckad här — tryck Checka ut när du går';
  end if;

  if not a.continuous and a.starts_at is not null
     and (now() < a.starts_at - interval '15 minutes'
          or now() > coalesce(a.starts_at + make_interval(mins => a.duration_min),
                              date_trunc('day', a.starts_at) + interval '1 day')) then
    raise exception 'Incheckningen är inte öppen just nu';
  end if;

  v_lat := coalesce(a.lat, f.lat); v_lng := coalesce(a.lng, f.lng);
  radius := coalesce(a.radius_m, f.geofence_radius_m);
  if v_lat is null or v_lng is null then raise exception 'Aktiviteten saknar plats'; end if;
  if p_lat is null or p_lng is null then raise exception 'Kunde inte läsa din plats'; end if;
  dist := public.distance_m(p_lat, p_lng, v_lat, v_lng);
  if dist > radius + least(coalesce(p_accuracy, 0), 60) then
    raise exception 'Du är för långt bort (% m från platsen)', round(dist)::int;
  end if;

  if a.requires_photo then
    if coalesce(p_photo_url, '') = '' then raise exception 'Den här incheckningen kräver ett foto'; end if;
    if p_photo_url not like auth.uid()::text || '/%' then raise exception 'Ogiltigt foto'; end if;
  end if;

  select count(*) into today_count from public.checkin c
   where c.user_id = auth.uid() and c.activity_id = a.id and c.created_at::date = current_date and c.pending = false;
  if today_count >= a.daily_limit then raise exception 'Du har checkat in max antal gånger idag'; end if;
  if exists (select 1 from public.checkin c where c.user_id = auth.uid() and c.activity_id = a.id and c.created_at > now() - interval '3 minutes') then
    raise exception 'Vänta en stund innan du checkar in igen';
  end if;

  if a.requires_checkout then
    insert into public.checkin (forening_id, user_id, activity_id, title, awarded_points, awarded_xp, photo_url, pending)
    values (a.forening_id, auth.uid(), a.id, a.title, 0, 0, nullif(p_photo_url, ''), true);
    return jsonb_build_object(
      'awarded_points', 0, 'awarded_xp', 0, 'level', m.level, 'leveled_up', false,
      'title', a.title, 'forening', f.name, 'action', 'checked_in', 'pending', true
    );
  end if;

  award := a.points;
  new_xp := m.xp + award; new_level := m.level;
  while new_xp >= xp_max loop new_xp := new_xp - xp_max; new_level := new_level + 1; leveled := true; end loop;
  select max(c.created_at::date) into last_visit from public.checkin c where c.user_id = auth.uid() and c.forening_id = a.forening_id and c.pending = false;
  if last_visit is null then new_streak := 1;
  elsif last_visit = current_date then new_streak := greatest(m.streak, 1);
  elsif last_visit = current_date - 1 then new_streak := m.streak + 1;
  else new_streak := 1; end if;

  insert into public.checkin (forening_id, user_id, activity_id, title, awarded_points, awarded_xp, photo_url)
  values (a.forening_id, auth.uid(), a.id, a.title, award, award, nullif(p_photo_url, ''));
  insert into public.points_ledger (forening_id, user_id, delta, reason)
  values (a.forening_id, auth.uid(), award, 'checkin:' || a.id::text);
  update public.membership set xp = new_xp, level = new_level, streak = new_streak, visits = visits + 1 where id = m.id;

  return jsonb_build_object(
    'awarded_points', award, 'awarded_xp', award, 'level', new_level, 'leveled_up', leveled,
    'title', a.title, 'forening', f.name, 'action', 'checked_in', 'pending', false
  );
end $$;
grant execute on function public.open_checkin(uuid, double precision, double precision, double precision, text) to authenticated;

-- ---------------------------------------------------------------------
-- check_in_child — barn-incheckning via QR
-- ---------------------------------------------------------------------
create or replace function public.check_in_child(
  p_child uuid, p_qr_token text, p_lat double precision default null, p_lng double precision default null, p_accuracy double precision default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.activity; f public.forening; ch public.child;
  v_lat double precision; v_lng double precision; dist double precision; radius int;
  award int; new_xp int; new_level int; leveled boolean := false; xp_max constant int := 1000;
  last_visit date; new_streak int; today_count int;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  select * into a from public.activity where qr_token = p_qr_token and active = true;
  if not found then raise exception 'Ogiltig eller inaktiv QR-kod'; end if;
  select * into f from public.forening where id = a.forening_id;
  select * into ch from public.child where id = p_child and parent_user_id = auth.uid() and forening_id = a.forening_id;
  if not found then raise exception 'Barnet tillhör inte den här föreningen'; end if;

  if not a.continuous and a.starts_at is not null
     and (now() < a.starts_at - interval '15 minutes'
          or now() > coalesce(a.starts_at + make_interval(mins => a.duration_min),
                              date_trunc('day', a.starts_at) + interval '1 day')) then
    raise exception 'Incheckningen är inte öppen just nu';
  end if;

  v_lat := coalesce(a.lat, f.lat); v_lng := coalesce(a.lng, f.lng);
  radius := coalesce(a.radius_m, f.geofence_radius_m);
  if v_lat is not null and v_lng is not null then
    if p_lat is null or p_lng is null then raise exception 'Kunde inte läsa din plats'; end if;
    dist := public.distance_m(p_lat, p_lng, v_lat, v_lng);
    if dist > radius + least(coalesce(p_accuracy, 0), 60) then
      raise exception 'Du är för långt bort (% m från platsen)', round(dist)::int;
    end if;
  end if;

  select count(*) into today_count from public.checkin c
   where c.child_id = p_child and c.activity_id = a.id and c.created_at::date = current_date;
  if today_count >= a.daily_limit then raise exception 'Barnet har checkat in max antal gånger idag'; end if;
  if exists (select 1 from public.checkin c where c.child_id = p_child and c.activity_id = a.id and c.created_at > now() - interval '3 minutes') then
    raise exception 'Vänta en stund innan du checkar in igen'; end if;

  award := a.points;
  new_xp := ch.xp + award; new_level := ch.level;
  while new_xp >= xp_max loop new_xp := new_xp - xp_max; new_level := new_level + 1; leveled := true; end loop;
  select max(c.created_at::date) into last_visit from public.checkin c where c.child_id = p_child and c.forening_id = a.forening_id;
  if last_visit is null then new_streak := 1;
  elsif last_visit = current_date then new_streak := greatest(ch.streak, 1);
  elsif last_visit = current_date - 1 then new_streak := ch.streak + 1;
  else new_streak := 1; end if;

  insert into public.checkin (forening_id, user_id, child_id, activity_id, title, awarded_points, awarded_xp)
  values (a.forening_id, auth.uid(), p_child, a.id, a.title, award, award);
  insert into public.points_ledger (forening_id, user_id, child_id, delta, reason)
  values (a.forening_id, auth.uid(), p_child, award, 'checkin:' || a.id::text);
  update public.child set xp = new_xp, level = new_level, streak = new_streak, visits = visits + 1 where id = p_child;

  return jsonb_build_object('awarded_points', award, 'awarded_xp', award, 'level', new_level,
    'leveled_up', leveled, 'title', a.title, 'forening', f.name, 'child', ch.display_name);
end $$;
grant execute on function public.check_in_child(uuid, text, double precision, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------
-- open_checkin_child — barn-incheckning öppen aktivitet
-- ---------------------------------------------------------------------
create or replace function public.open_checkin_child(
  p_child uuid, p_activity uuid, p_lat double precision default null, p_lng double precision default null,
  p_accuracy double precision default null, p_photo_url text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.activity; f public.forening; ch public.child;
  v_lat double precision; v_lng double precision; dist double precision; radius int;
  award int; new_xp int; new_level int; leveled boolean := false; xp_max constant int := 1000;
  last_visit date; new_streak int; today_count int;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  select * into a from public.activity where id = p_activity and active = true;
  if not found then raise exception 'Aktiviteten finns inte'; end if;
  if a.checkin_mode <> 'open' then raise exception 'Den här aktiviteten kräver QR-kod'; end if;
  select * into f from public.forening where id = a.forening_id;
  select * into ch from public.child where id = p_child and parent_user_id = auth.uid() and forening_id = a.forening_id;
  if not found then raise exception 'Barnet tillhör inte den här föreningen'; end if;

  if not a.continuous and a.starts_at is not null
     and (now() < a.starts_at - interval '15 minutes'
          or now() > coalesce(a.starts_at + make_interval(mins => a.duration_min),
                              date_trunc('day', a.starts_at) + interval '1 day')) then
    raise exception 'Incheckningen är inte öppen just nu';
  end if;

  v_lat := coalesce(a.lat, f.lat); v_lng := coalesce(a.lng, f.lng);
  radius := coalesce(a.radius_m, f.geofence_radius_m);
  if v_lat is null or v_lng is null then raise exception 'Aktiviteten saknar plats'; end if;
  if p_lat is null or p_lng is null then raise exception 'Kunde inte läsa din plats'; end if;
  dist := public.distance_m(p_lat, p_lng, v_lat, v_lng);
  if dist > radius + least(coalesce(p_accuracy, 0), 60) then
    raise exception 'Du är för långt bort (% m från platsen)', round(dist)::int;
  end if;

  if a.requires_photo then
    if coalesce(p_photo_url, '') = '' then raise exception 'Den här incheckningen kräver ett foto'; end if;
    if p_photo_url not like auth.uid()::text || '/%' then raise exception 'Ogiltigt foto'; end if;
  end if;

  select count(*) into today_count from public.checkin c
   where c.child_id = p_child and c.activity_id = a.id and c.created_at::date = current_date;
  if today_count >= a.daily_limit then raise exception 'Barnet har checkat in max antal gånger idag'; end if;
  if exists (select 1 from public.checkin c where c.child_id = p_child and c.activity_id = a.id and c.created_at > now() - interval '3 minutes') then
    raise exception 'Vänta en stund innan du checkar in igen'; end if;

  award := a.points;
  new_xp := ch.xp + award; new_level := ch.level;
  while new_xp >= xp_max loop new_xp := new_xp - xp_max; new_level := new_level + 1; leveled := true; end loop;
  select max(c.created_at::date) into last_visit from public.checkin c where c.child_id = p_child and c.forening_id = a.forening_id;
  if last_visit is null then new_streak := 1;
  elsif last_visit = current_date then new_streak := greatest(ch.streak, 1);
  elsif last_visit = current_date - 1 then new_streak := ch.streak + 1;
  else new_streak := 1; end if;

  insert into public.checkin (forening_id, user_id, child_id, activity_id, title, awarded_points, awarded_xp, photo_url)
  values (a.forening_id, auth.uid(), p_child, a.id, a.title, award, award, nullif(p_photo_url, ''));
  insert into public.points_ledger (forening_id, user_id, child_id, delta, reason)
  values (a.forening_id, auth.uid(), p_child, award, 'checkin:' || a.id::text);
  update public.child set xp = new_xp, level = new_level, streak = new_streak, visits = visits + 1 where id = p_child;

  return jsonb_build_object('awarded_points', award, 'awarded_xp', award, 'level', new_level,
    'leveled_up', leveled, 'title', a.title, 'forening', f.name, 'child', ch.display_name);
end $$;
grant execute on function public.open_checkin_child(uuid, uuid, double precision, double precision, double precision, text) to authenticated;

-- ---------------------------------------------------------------------
-- youth_open_activities — dölj öppna aktiviteter som gått ut
-- (icke-kontinuerliga utanför sitt fönster syns inte längre)
-- ---------------------------------------------------------------------
drop function if exists public.youth_open_activities(uuid);
create or replace function public.youth_open_activities(p_forening uuid)
returns table (id uuid, title text, points int, requires_photo boolean, lat double precision, lng double precision, daily_limit int, done_today int, requires_checkout boolean)
language sql security definer set search_path = '' stable as $$
  select a.id, a.title, a.points, a.requires_photo, a.lat, a.lng, a.daily_limit,
         (select count(*)::int from public.checkin c
           where c.user_id = auth.uid() and c.activity_id = a.id and c.created_at::date = current_date and c.pending = false),
         a.requires_checkout
    from public.activity a
   where a.forening_id = p_forening and a.active and a.checkin_mode = 'open'
     and exists (select 1 from public.membership m where m.user_id = auth.uid() and m.forening_id = p_forening)
     and (a.continuous
          or (a.starts_at is not null
              and now() >= a.starts_at - interval '15 minutes'
              and now() <= coalesce(a.starts_at + make_interval(mins => a.duration_min),
                                    date_trunc('day', a.starts_at) + interval '1 day')))
     and (select count(*) from public.checkin c
           where c.user_id = auth.uid() and c.activity_id = a.id and c.created_at::date = current_date and c.pending = false) < a.daily_limit
     and not exists (select 1 from public.checkin c
           where c.user_id = auth.uid() and c.activity_id = a.id and c.pending = true and c.checkout_at is null)
   order by a.title;
$$;
grant execute on function public.youth_open_activities(uuid) to authenticated;

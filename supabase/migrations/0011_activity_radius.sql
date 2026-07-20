-- =====================================================================
-- LEVLA — 0011 per-activity check-in location radius
-- An activity can have its OWN check-in place (activity.lat/lng) and now its
-- OWN radius (activity.radius_m). Falls back to the förening's radius/place.
-- =====================================================================

alter table public.activity add column if not exists radius_m integer;

-- ---------- publish_activity v4 (adds per-activity radius) ----------
drop function if exists public.publish_activity(uuid, text, text, int, text, text, double precision, double precision, timestamptz, boolean, text, boolean, int, int);
create or replace function public.publish_activity(
  p_forening uuid, p_title text, p_when text, p_points int, p_place text, p_theme text,
  p_lat double precision default null, p_lng double precision default null,
  p_starts_at timestamptz default null, p_continuous boolean default false,
  p_checkin_mode text default 'qr', p_requires_photo boolean default false,
  p_duration_min int default null, p_daily_limit int default 1, p_radius_m int default null
) returns public.activity language plpgsql security definer set search_path = '' as $$
declare
  a    public.activity;
  mode text := coalesce(nullif(p_checkin_mode, ''), 'qr');
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not private.has_forening_role(p_forening, 'ledare') then
    raise exception 'Endast ledare kan publicera aktiviteter';
  end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Skriv ett namn'; end if;
  if mode = 'open' and (p_lat is null or p_lng is null) then
    raise exception 'Öppna aktiviteter (utan QR) kräver en plats';
  end if;

  insert into public.activity (
    forening_id, title, when_text, points, place_label, theme, lat, lng,
    starts_at, continuous, checkin_mode, requires_photo, duration_min, daily_limit, radius_m, created_by
  ) values (
    p_forening, trim(p_title), nullif(trim(coalesce(p_when, '')), ''),
    coalesce(p_points, 30), nullif(trim(coalesce(p_place, '')), ''),
    coalesce(nullif(trim(coalesce(p_theme, '')), ''), 'fika'), p_lat, p_lng,
    p_starts_at, coalesce(p_continuous, false), mode, coalesce(p_requires_photo, false),
    p_duration_min, greatest(coalesce(p_daily_limit, 1), 1),
    case when p_radius_m is not null then greatest(p_radius_m, 20) else null end, auth.uid()
  ) returning * into a;

  insert into public.notification (forening_id, user_id, icon, tint, title, body)
  select p_forening, mem.user_id, 'target', '#ede7ff',
         'Ny aktivitet: ' || a.title,
         coalesce(a.when_text || ' · ', '') || '+' || a.points::text || ' poäng'
    from public.membership mem
   where mem.forening_id = p_forening and mem.role = 'ungdom';

  return a;
end $$;
grant execute on function public.publish_activity(uuid, text, text, int, text, text, double precision, double precision, timestamptz, boolean, text, boolean, int, int, int) to authenticated;

-- ---------- check_in v4 (per-activity radius) ----------
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

  if not a.continuous and a.starts_at is not null and a.duration_min is not null
     and (now() < a.starts_at - interval '15 minutes' or now() > a.starts_at + make_interval(mins => a.duration_min)) then
    raise exception 'Incheckningen är inte öppen just nu';
  end if;

  v_lat := coalesce(a.lat, f.lat); v_lng := coalesce(a.lng, f.lng);
  radius := coalesce(a.radius_m, f.geofence_radius_m);
  if v_lat is not null and v_lng is not null and p_lat is not null and p_lng is not null then
    dist := public.distance_m(p_lat, p_lng, v_lat, v_lng);
    if dist > radius + least(coalesce(p_accuracy, 0), 60) then
      raise exception 'Du är för långt bort (% m från platsen)', round(dist)::int;
    end if;
  end if;

  select count(*) into today_count from public.checkin c
   where c.user_id = auth.uid() and c.activity_id = a.id and c.created_at::date = current_date;
  if today_count >= a.daily_limit then raise exception 'Du har checkat in max antal gånger idag'; end if;
  if exists (select 1 from public.checkin c where c.user_id = auth.uid() and c.activity_id = a.id and c.created_at > now() - interval '3 minutes') then
    raise exception 'Vänta en stund innan du checkar in igen';
  end if;

  award := a.points;
  new_xp := m.xp + award; new_level := m.level;
  while new_xp >= xp_max loop new_xp := new_xp - xp_max; new_level := new_level + 1; leveled := true; end loop;
  select max(c.created_at::date) into last_visit from public.checkin c where c.user_id = auth.uid() and c.forening_id = a.forening_id;
  if last_visit is null then new_streak := 1;
  elsif last_visit = current_date then new_streak := greatest(m.streak, 1);
  elsif last_visit = current_date - 1 then new_streak := m.streak + 1;
  else new_streak := 1; end if;

  insert into public.checkin (forening_id, user_id, activity_id, title, awarded_points, awarded_xp)
  values (a.forening_id, auth.uid(), a.id, a.title, award, award);
  insert into public.points_ledger (forening_id, user_id, delta, reason)
  values (a.forening_id, auth.uid(), award, 'checkin:' || a.id::text);
  update public.membership set xp = new_xp, level = new_level, streak = new_streak, visits = visits + 1 where id = m.id;

  return jsonb_build_object('awarded_points', award, 'awarded_xp', award, 'level', new_level, 'leveled_up', leveled, 'title', a.title, 'forening', f.name);
end $$;
grant execute on function public.check_in(text, double precision, double precision, double precision) to authenticated;

-- ---------- open_checkin v3 (per-activity radius) ----------
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

  if not a.continuous and a.starts_at is not null and a.duration_min is not null
     and (now() < a.starts_at - interval '15 minutes' or now() > a.starts_at + make_interval(mins => a.duration_min)) then
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

  if a.requires_photo and coalesce(p_photo_url, '') = '' then raise exception 'Den här incheckningen kräver ett foto'; end if;

  select count(*) into today_count from public.checkin c
   where c.user_id = auth.uid() and c.activity_id = a.id and c.created_at::date = current_date;
  if today_count >= a.daily_limit then raise exception 'Du har checkat in max antal gånger idag'; end if;
  if exists (select 1 from public.checkin c where c.user_id = auth.uid() and c.activity_id = a.id and c.created_at > now() - interval '3 minutes') then
    raise exception 'Vänta en stund innan du checkar in igen';
  end if;

  award := a.points;
  new_xp := m.xp + award; new_level := m.level;
  while new_xp >= xp_max loop new_xp := new_xp - xp_max; new_level := new_level + 1; leveled := true; end loop;
  select max(c.created_at::date) into last_visit from public.checkin c where c.user_id = auth.uid() and c.forening_id = a.forening_id;
  if last_visit is null then new_streak := 1;
  elsif last_visit = current_date then new_streak := greatest(m.streak, 1);
  elsif last_visit = current_date - 1 then new_streak := m.streak + 1;
  else new_streak := 1; end if;

  insert into public.checkin (forening_id, user_id, activity_id, title, awarded_points, awarded_xp, photo_url)
  values (a.forening_id, auth.uid(), a.id, a.title, award, award, nullif(p_photo_url, ''));
  insert into public.points_ledger (forening_id, user_id, delta, reason)
  values (a.forening_id, auth.uid(), award, 'checkin:' || a.id::text);
  update public.membership set xp = new_xp, level = new_level, streak = new_streak, visits = visits + 1 where id = m.id;

  return jsonb_build_object('awarded_points', award, 'awarded_xp', award, 'level', new_level, 'leveled_up', leveled, 'title', a.title, 'forening', f.name);
end $$;
grant execute on function public.open_checkin(uuid, double precision, double precision, double precision, text) to authenticated;

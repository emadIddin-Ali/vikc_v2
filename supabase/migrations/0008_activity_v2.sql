-- =====================================================================
-- LEVLA — 0008 activity v2
--  * scheduled time (starts_at) for a calendar/agenda
--  * continuous activities (always available) + open check-in without QR
--  * photo verification for on-site proof (Supabase Storage)
-- =====================================================================

alter table public.activity
  add column if not exists starts_at      timestamptz,
  add column if not exists continuous     boolean not null default false,
  add column if not exists checkin_mode   text    not null default 'qr',  -- 'qr' | 'open'
  add column if not exists requires_photo boolean not null default false;

alter table public.checkin
  add column if not exists photo_url text;

-- ---------- Storage bucket for check-in photos ----------
insert into storage.buckets (id, name, public)
values ('checkin-photos', 'checkin-photos', true)
on conflict (id) do nothing;

drop policy if exists checkin_photos_insert on storage.objects;
create policy checkin_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'checkin-photos');

drop policy if exists checkin_photos_read on storage.objects;
create policy checkin_photos_read on storage.objects for select to public
  using (bucket_id = 'checkin-photos');

-- ---------- publish_activity v2 (adds time / continuous / mode / photo) ----------
drop function if exists public.publish_activity(uuid, text, text, int, text, text, double precision, double precision);
create or replace function public.publish_activity(
  p_forening      uuid,
  p_title         text,
  p_when          text,
  p_points        int,
  p_place         text,
  p_theme         text,
  p_lat           double precision default null,
  p_lng           double precision default null,
  p_starts_at     timestamptz default null,
  p_continuous    boolean default false,
  p_checkin_mode  text default 'qr',
  p_requires_photo boolean default false
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
    starts_at, continuous, checkin_mode, requires_photo, created_by
  ) values (
    p_forening, trim(p_title), nullif(trim(coalesce(p_when, '')), ''),
    coalesce(p_points, 30), nullif(trim(coalesce(p_place, '')), ''),
    coalesce(nullif(trim(coalesce(p_theme, '')), ''), 'fika'), p_lat, p_lng,
    p_starts_at, coalesce(p_continuous, false), mode, coalesce(p_requires_photo, false), auth.uid()
  ) returning * into a;

  insert into public.notification (forening_id, user_id, icon, tint, title, body)
  select p_forening, mem.user_id, 'target', '#ede7ff',
         'Ny aktivitet: ' || a.title,
         coalesce(a.when_text || ' · ', '') || '+' || a.points::text || ' poäng'
    from public.membership mem
   where mem.forening_id = p_forening and mem.role = 'ungdom';

  return a;
end $$;
grant execute on function public.publish_activity(uuid, text, text, int, text, text, double precision, double precision, timestamptz, boolean, text, boolean) to authenticated;

-- ---------- open_checkin: check in to an "open" activity (no QR) ----------
-- Anti-cheat: geofence is REQUIRED (device must be within radius); photo if the
-- activity requires it. Server owns the award, identical engine to check_in().
create or replace function public.open_checkin(
  p_activity uuid,
  p_lat double precision default null,
  p_lng double precision default null,
  p_photo_url text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a          public.activity;
  f          public.forening;
  m          public.membership;
  v_lat      double precision;
  v_lng      double precision;
  dist       double precision;
  award      integer;
  new_xp     integer;
  new_level  integer;
  leveled    boolean := false;
  xp_max     constant integer := 1000;
  last_visit date;
  new_streak integer;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;

  select * into a from public.activity where id = p_activity and active = true;
  if not found then raise exception 'Aktiviteten finns inte'; end if;
  if a.checkin_mode <> 'open' then raise exception 'Den här aktiviteten kräver QR-kod'; end if;

  select * into f from public.forening where id = a.forening_id;
  select * into m from public.membership where user_id = auth.uid() and forening_id = a.forening_id;
  if not found then raise exception 'Du är inte medlem i den här föreningen'; end if;

  -- geofence REQUIRED for open check-ins
  v_lat := coalesce(a.lat, f.lat);
  v_lng := coalesce(a.lng, f.lng);
  if v_lat is null or v_lng is null then raise exception 'Aktiviteten saknar plats'; end if;
  if p_lat is null or p_lng is null then raise exception 'Kunde inte läsa din plats'; end if;
  dist := public.distance_m(p_lat, p_lng, v_lat, v_lng);
  if dist > f.geofence_radius_m then
    raise exception 'Du är för långt bort (% m från platsen)', round(dist)::int;
  end if;

  if a.requires_photo and coalesce(p_photo_url, '') = '' then
    raise exception 'Den här incheckningen kräver ett foto';
  end if;

  if exists (
    select 1 from public.checkin c
     where c.user_id = auth.uid() and c.activity_id = a.id
       and c.created_at > now() - interval '8 hours'
  ) then
    raise exception 'Du har redan checkat in här nyligen';
  end if;

  award := a.points;
  new_xp := m.xp + award;
  new_level := m.level;
  while new_xp >= xp_max loop
    new_xp := new_xp - xp_max; new_level := new_level + 1; leveled := true;
  end loop;

  select max(c.created_at::date) into last_visit
    from public.checkin c where c.user_id = auth.uid() and c.forening_id = a.forening_id;
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
    'awarded_points', award, 'awarded_xp', award,
    'level', new_level, 'leveled_up', leveled, 'title', a.title, 'forening', f.name
  );
end $$;
grant execute on function public.open_checkin(uuid, double precision, double precision, text) to authenticated;

-- ---------- recent activity feed for the leader (who has been active) ----------
create or replace function public.ledare_recent_checkins(p_forening uuid, p_limit int default 30)
returns table (name text, title text, points int, at timestamptz, photo_url text)
language sql security definer set search_path = '' stable as $$
  select coalesce(nullif(p.display_name, ''), 'Medlem'),
         coalesce(c.title, a.title, 'Incheckning'),
         c.awarded_points, c.created_at, c.photo_url
    from public.checkin c
    join public.profiles p on p.id = c.user_id
    left join public.activity a on a.id = c.activity_id
   where c.forening_id = p_forening
     and private.has_forening_role(p_forening, 'ledare')
   order by c.created_at desc
   limit greatest(p_limit, 1);
$$;
grant execute on function public.ledare_recent_checkins(uuid, int) to authenticated;

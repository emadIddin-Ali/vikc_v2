-- =====================================================================
-- LEVLA — 0033 minsta tid på plats innan utcheckning
--
-- "Kräv utcheckning" gjorde poängen beroende av ATT ungdomen checkade ut,
-- men inte av HUR LÄNGE hen stannade. Man kunde checka in i dörren, gå ut
-- i korridoren och checka ut direkt — och få full poäng. Nu kan ledaren
-- sätta en minsta tid per aktivitet:
--
--   min_stay_min = 0   → som förut, utcheckning direkt
--   min_stay_min = 45  → utcheckningen (och därmed poängen) släpps först
--                        45 minuter efter incheckningen
--
-- Gränsen ligger i check_out, inte i appen. Appen räknar ner samma tid för
-- att knappen ska kännas ärlig, men en manipulerad klient kommer inte förbi
-- servern. Ingen automatisk utcheckning: glömmer man bort sig uteblir
-- poängen, precis som 0019 bestämde.
--
-- Rör: activity (ny kolumn), check_out, my_open_checkins, publish_activity.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Kolumnen
-- ---------------------------------------------------------------------
alter table public.activity
  add column if not exists min_stay_min int not null default 0;

comment on column public.activity.min_stay_min is
  'Minsta antal minuter mellan incheckning och utcheckning. 0 = ingen väntan.';

-- Taket på ett dygn är en skrivfelsspärr, inte en regel: en aktivitet som
-- kräver mer än 24 timmar på plats är alltid ett misstag.
alter table public.activity drop constraint if exists activity_min_stay_min_check;
alter table public.activity
  add constraint activity_min_stay_min_check check (min_stay_min >= 0 and min_stay_min <= 1440);

-- ---------------------------------------------------------------------
-- 2. check_out — samma funktion som i 0024, med tidsspärren tillagd
-- ---------------------------------------------------------------------
create or replace function public.check_out(
  p_activity uuid, p_lat double precision default null, p_lng double precision default null,
  p_accuracy double precision default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.activity; f public.forening; m public.membership; ci public.checkin;
  v_lat double precision; v_lng double precision; dist double precision; radius int;
  award int; new_xp int; new_level int; leveled boolean := false; xp_max constant int := 1000;
  last_visit date; new_streak int;
  kvar int;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  select * into a from public.activity where id = p_activity;
  if not found then raise exception 'Aktiviteten finns inte'; end if;
  select * into f from public.forening where id = a.forening_id;
  select * into m from public.membership where user_id = auth.uid() and forening_id = a.forening_id;
  if not found then raise exception 'Du är inte medlem i den här föreningen'; end if;

  select * into ci from public.checkin c
   where c.user_id = auth.uid() and c.activity_id = a.id and c.pending = true and c.checkout_at is null
   order by c.created_at desc limit 1;
  if not found then raise exception 'Du är inte incheckad på den här aktiviteten'; end if;

  -- Tidsspärren före geo-kontrollen: är man för tidig spelar det ingen roll
  -- var man står, och beskedet ska säga det som faktiskt saknas.
  if coalesce(a.min_stay_min, 0) > 0 then
    kvar := ceil(extract(epoch from
              (ci.created_at + make_interval(mins => a.min_stay_min) - now())) / 60.0)::int;
    if kvar > 0 then
      raise exception 'Du måste stanna kvar % minut% till innan du kan checka ut',
        kvar, case when kvar = 1 then '' else 'er' end;
    end if;
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

  award := a.points;
  new_xp := m.xp + award; new_level := m.level;
  while new_xp >= xp_max loop new_xp := new_xp - xp_max; new_level := new_level + 1; leveled := true; end loop;

  select max(c.created_at::date) into last_visit from public.checkin c
   where c.user_id = auth.uid() and c.forening_id = a.forening_id and c.pending = false;
  if last_visit is null then new_streak := 1;
  elsif last_visit = current_date then new_streak := greatest(m.streak, 1);
  elsif last_visit = current_date - 1 then new_streak := m.streak + 1;
  else new_streak := 1; end if;

  update public.checkin
     set awarded_points = award, awarded_xp = award, checkout_at = now(), pending = false
   where id = ci.id;
  insert into public.points_ledger (forening_id, user_id, delta, reason)
  values (a.forening_id, auth.uid(), award, 'checkin:' || a.id::text);
  update public.membership
     set xp = new_xp, level = new_level, streak = new_streak, visits = visits + 1
   where id = m.id;

  return jsonb_build_object(
    'awarded_points', award, 'awarded_xp', award, 'level', new_level, 'leveled_up', leveled,
    'title', a.title, 'forening', f.name, 'action', 'checked_out', 'pending', false
  );
end $$;
grant execute on function public.check_out(uuid, double precision, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------
-- 3. my_open_checkins — säg NÄR utcheckningen släpps
--
-- DROP först: RETURNS TABLE utökas med can_checkout_at, och Postgres tillåter
-- inte att create-or-replace ändrar en funktions return-typ.
-- ---------------------------------------------------------------------
drop function if exists public.my_open_checkins(uuid);
create or replace function public.my_open_checkins(p_forening uuid)
returns table (
  id uuid, activity_id uuid, title text, points int,
  lat double precision, lng double precision,
  started_at timestamptz, can_checkout_at timestamptz
)
language sql security definer set search_path = '' stable as $$
  select c.id, a.id, coalesce(c.title, a.title), a.points, a.lat, a.lng, c.created_at,
         c.created_at + make_interval(mins => coalesce(a.min_stay_min, 0))
    from public.checkin c
    join public.activity a on a.id = c.activity_id
   where c.user_id = auth.uid() and c.forening_id = p_forening
     and c.pending = true and c.checkout_at is null
   order by c.created_at desc;
$$;
grant execute on function public.my_open_checkins(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. publish_activity v6 — ledaren sätter tiden när aktiviteten skapas
-- ---------------------------------------------------------------------
drop function if exists public.publish_activity(uuid, text, text, int, text, text, double precision, double precision, timestamptz, boolean, text, boolean, int, int, int, boolean);
create or replace function public.publish_activity(
  p_forening uuid, p_title text, p_when text, p_points int, p_place text, p_theme text,
  p_lat double precision default null, p_lng double precision default null,
  p_starts_at timestamptz default null, p_continuous boolean default false,
  p_checkin_mode text default 'qr', p_requires_photo boolean default false,
  p_duration_min int default null, p_daily_limit int default 1, p_radius_m int default null,
  p_requires_checkout boolean default false, p_min_stay_min int default 0
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
    starts_at, continuous, checkin_mode, requires_photo, duration_min, daily_limit, radius_m,
    requires_checkout, min_stay_min, created_by
  ) values (
    p_forening, trim(p_title), nullif(trim(coalesce(p_when, '')), ''),
    coalesce(p_points, 30), nullif(trim(coalesce(p_place, '')), ''),
    coalesce(nullif(trim(coalesce(p_theme, '')), ''), 'fika'), p_lat, p_lng,
    p_starts_at, coalesce(p_continuous, false), mode, coalesce(p_requires_photo, false),
    p_duration_min, greatest(coalesce(p_daily_limit, 1), 1),
    case when p_radius_m is not null then greatest(p_radius_m, 20) else null end,
    coalesce(p_requires_checkout, false),
    -- Tiden är meningslös utan utcheckning; noll den hellre än att spara en
    -- siffra som ingen någonsin läser.
    case when coalesce(p_requires_checkout, false)
         then least(greatest(coalesce(p_min_stay_min, 0), 0), 1440) else 0 end,
    auth.uid()
  ) returning * into a;

  insert into public.notification (forening_id, user_id, icon, tint, title, body)
  select p_forening, mem.user_id, 'target', '#ede7ff',
         'Ny aktivitet: ' || a.title,
         coalesce(a.when_text || ' · ', '') || '+' || a.points::text || ' poäng'
    from public.membership mem
   where mem.forening_id = p_forening and mem.role = 'ungdom';

  return a;
end $$;
grant execute on function public.publish_activity(uuid, text, text, int, text, text, double precision, double precision, timestamptz, boolean, text, boolean, int, int, int, boolean, int) to authenticated;

-- =====================================================================
-- LEVLA — 0019 utcheckning (check-out)
--
-- Vissa aktiviteter kräver att man STANNAR kvar: poängen delas inte ut vid
-- incheckning utan först vid UTCHECKNING. En incheckning på en sådan
-- aktivitet skapar en "öppen" rad (pending = true, 0 poäng). Vid utcheckning
-- delas poäng/XP/streak ut och raden stängs.
--
-- Utcheckning sker på två sätt (båda geo-verifierade):
--   * Knapp i appen  → check_out(aktivitet, position)
--   * Skanna QR igen → check_in() upptäcker den öppna raden och gör utcheckning
--
-- Ingen auto-utcheckning: glömmer man att checka ut uteblir poängen.
-- =====================================================================

-- ---------- schema ----------
alter table public.activity add column if not exists requires_checkout boolean not null default false;
alter table public.checkin  add column if not exists checkout_at timestamptz;
alter table public.checkin  add column if not exists pending     boolean not null default false;

create index if not exists idx_checkin_open
  on public.checkin(user_id, activity_id) where pending = true;

-- ---------- mission-bump: bara för AVSLUTADE incheckningar ----------
-- En öppen (pending) rad ska inte fylla Mål förrän man faktiskt checkat ut.
-- Därför: bumpa vid insert av en icke-pending rad, ELLER när en pending rad
-- stängs (pending true → false vid utcheckning).
drop trigger if exists on_checkin_bump on public.checkin;
create trigger on_checkin_bump after insert on public.checkin
  for each row when (new.pending is not true)
  execute function public.bump_auto_missions();

drop trigger if exists on_checkout_bump on public.checkin;
create trigger on_checkout_bump after update on public.checkin
  for each row when (old.pending is true and new.pending is false)
  execute function public.bump_auto_missions();

-- ---------- check_out: stäng den öppna raden och dela ut poängen ----------
-- Fungerar för både QR- och öppna aktiviteter (tar aktivitetens id). Kräver
-- INTE att aktiviteten fortfarande är aktiv — man ska alltid kunna checka ut.
create or replace function public.check_out(
  p_activity uuid, p_lat double precision default null, p_lng double precision default null,
  p_accuracy double precision default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.activity; f public.forening; m public.membership; ci public.checkin;
  v_lat double precision; v_lng double precision; dist double precision; radius int;
  award int; new_xp int; new_level int; leveled boolean := false; xp_max constant int := 1000;
  last_visit date; new_streak int;
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

  v_lat := coalesce(a.lat, f.lat); v_lng := coalesce(a.lng, f.lng);
  radius := coalesce(a.radius_m, f.geofence_radius_m);
  if v_lat is not null and v_lng is not null and p_lat is not null and p_lng is not null then
    dist := public.distance_m(p_lat, p_lng, v_lat, v_lng);
    if dist > radius + least(coalesce(p_accuracy, 0), 60) then
      raise exception 'Du är för långt bort (% m från platsen)', round(dist)::int;
    end if;
  end if;

  award := a.points;
  new_xp := m.xp + award; new_level := m.level;
  while new_xp >= xp_max loop new_xp := new_xp - xp_max; new_level := new_level + 1; leveled := true; end loop;

  -- Streak räknas på AVSLUTADE besök (den öppna raden räknas inte med).
  select max(c.created_at::date) into last_visit from public.checkin c
   where c.user_id = auth.uid() and c.forening_id = a.forening_id and c.pending = false;
  if last_visit is null then new_streak := 1;
  elsif last_visit = current_date then new_streak := greatest(m.streak, 1);
  elsif last_visit = current_date - 1 then new_streak := m.streak + 1;
  else new_streak := 1; end if;

  -- Stäng raden (triggern on_checkout_bump fyller Mål-uppdrag här).
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

-- ---------- check_in v5 (utcheckning via QR-omskanning + pending-läge) ----------
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

  -- Redan incheckad på en utcheckningsaktivitet? Då betyder en ny skanning
  -- att man checkar UT.
  if a.requires_checkout and exists (
       select 1 from public.checkin c
        where c.user_id = auth.uid() and c.activity_id = a.id and c.pending = true and c.checkout_at is null
     ) then
    return public.check_out(a.id, p_lat, p_lng, p_accuracy);
  end if;

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
   where c.user_id = auth.uid() and c.activity_id = a.id and c.created_at::date = current_date and c.pending = false;
  if today_count >= a.daily_limit then raise exception 'Du har checkat in max antal gånger idag'; end if;
  if exists (select 1 from public.checkin c where c.user_id = auth.uid() and c.activity_id = a.id and c.created_at > now() - interval '3 minutes') then
    raise exception 'Vänta en stund innan du checkar in igen';
  end if;

  -- Utcheckningsaktivitet: skapa en öppen rad, dela INTE ut poäng ännu.
  if a.requires_checkout then
    insert into public.checkin (forening_id, user_id, activity_id, title, awarded_points, awarded_xp, pending)
    values (a.forening_id, auth.uid(), a.id, a.title, 0, 0, true);
    return jsonb_build_object(
      'awarded_points', 0, 'awarded_xp', 0, 'level', m.level, 'leveled_up', false,
      'title', a.title, 'forening', f.name, 'action', 'checked_in', 'pending', true
    );
  end if;

  -- Vanlig aktivitet: dela ut poäng direkt.
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

-- ---------- open_checkin v4 (pending-läge för öppna aktiviteter) ----------
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

  -- Öppna aktiviteter har ingen QR att skanna igen — utcheckning sker via
  -- "Checka ut"-knappen (check_out). Blockera en andra incheckning här.
  if a.requires_checkout and exists (
       select 1 from public.checkin c
        where c.user_id = auth.uid() and c.activity_id = a.id and c.pending = true and c.checkout_at is null
     ) then
    raise exception 'Du är redan incheckad här — tryck Checka ut när du går';
  end if;

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
   where c.user_id = auth.uid() and c.activity_id = a.id and c.created_at::date = current_date and c.pending = false;
  if today_count >= a.daily_limit then raise exception 'Du har checkat in max antal gånger idag'; end if;
  if exists (select 1 from public.checkin c where c.user_id = auth.uid() and c.activity_id = a.id and c.created_at > now() - interval '3 minutes') then
    raise exception 'Vänta en stund innan du checkar in igen';
  end if;

  -- Utcheckningsaktivitet: öppen rad utan poäng ännu.
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

-- ---------- my_open_checkins: aktiva sessioner jag ännu inte checkat ut ur ----------
create or replace function public.my_open_checkins(p_forening uuid)
returns table (id uuid, activity_id uuid, title text, points int, lat double precision, lng double precision, started_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select c.id, a.id, coalesce(c.title, a.title), a.points, a.lat, a.lng, c.created_at
    from public.checkin c
    join public.activity a on a.id = c.activity_id
   where c.user_id = auth.uid() and c.forening_id = p_forening
     and c.pending = true and c.checkout_at is null
   order by c.created_at desc;
$$;
grant execute on function public.my_open_checkins(uuid) to authenticated;

-- ---------- youth_open_activities v2: dölj det man redan är incheckad på ----------
-- DROP först: vi utökar RETURNS TABLE med requires_checkout, och Postgres tillåter
-- inte att create-or-replace ändrar en funktions return-typ.
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
     and (a.continuous or a.starts_at is null or a.duration_min is null
          or (now() >= a.starts_at - interval '15 minutes' and now() <= a.starts_at + make_interval(mins => a.duration_min)))
     and (select count(*) from public.checkin c
           where c.user_id = auth.uid() and c.activity_id = a.id and c.created_at::date = current_date and c.pending = false) < a.daily_limit
     and not exists (select 1 from public.checkin c
           where c.user_id = auth.uid() and c.activity_id = a.id and c.pending = true and c.checkout_at is null)
   order by a.title;
$$;
grant execute on function public.youth_open_activities(uuid) to authenticated;

-- ---------- publish_activity v5 (adds requires_checkout) ----------
drop function if exists public.publish_activity(uuid, text, text, int, text, text, double precision, double precision, timestamptz, boolean, text, boolean, int, int, int);
create or replace function public.publish_activity(
  p_forening uuid, p_title text, p_when text, p_points int, p_place text, p_theme text,
  p_lat double precision default null, p_lng double precision default null,
  p_starts_at timestamptz default null, p_continuous boolean default false,
  p_checkin_mode text default 'qr', p_requires_photo boolean default false,
  p_duration_min int default null, p_daily_limit int default 1, p_radius_m int default null,
  p_requires_checkout boolean default false
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
    requires_checkout, created_by
  ) values (
    p_forening, trim(p_title), nullif(trim(coalesce(p_when, '')), ''),
    coalesce(p_points, 30), nullif(trim(coalesce(p_place, '')), ''),
    coalesce(nullif(trim(coalesce(p_theme, '')), ''), 'fika'), p_lat, p_lng,
    p_starts_at, coalesce(p_continuous, false), mode, coalesce(p_requires_photo, false),
    p_duration_min, greatest(coalesce(p_daily_limit, 1), 1),
    case when p_radius_m is not null then greatest(p_radius_m, 20) else null end,
    coalesce(p_requires_checkout, false), auth.uid()
  ) returning * into a;

  insert into public.notification (forening_id, user_id, icon, tint, title, body)
  select p_forening, mem.user_id, 'target', '#ede7ff',
         'Ny aktivitet: ' || a.title,
         coalesce(a.when_text || ' · ', '') || '+' || a.points::text || ' poäng'
    from public.membership mem
   where mem.forening_id = p_forening and mem.role = 'ungdom';

  return a;
end $$;
grant execute on function public.publish_activity(uuid, text, text, int, text, text, double precision, double precision, timestamptz, boolean, text, boolean, int, int, int, boolean) to authenticated;

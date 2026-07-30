-- =====================================================================
-- LEVLA — 0023 föräldrar + barn (grunderna)
--
-- En förälder har ett eget konto och går med i föreningen som 'foralder'.
-- Föräldern lägger till ETT ELLER FLERA barn — profiler UTAN egen inloggning
-- (för små barn utan telefon). Varje barn har egna poäng/nivå/streak, scopat
-- till föreningen. Föräldern checkar in barnet på plats (QR/geo); poängen
-- krediteras barnet direkt (ingen utcheckning, inga uppdrag/märken för barn än).
--
-- KRÄVER att 0022 (enum-värdet 'foralder') körts först.
-- =====================================================================

-- ---------- barn-tabell ----------
create table if not exists public.child (
  id             uuid primary key default gen_random_uuid(),
  forening_id    uuid not null references public.forening(id) on delete cascade,
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  display_name   text not null,
  avatar_color   text not null default '#6c4cf1',
  birth_year     integer,
  points         integer not null default 0,
  xp             integer not null default 0,
  level          integer not null default 1,
  streak         integer not null default 0,
  visits         integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists idx_child_parent   on public.child(parent_user_id);
create index if not exists idx_child_forening  on public.child(forening_id);

alter table public.child enable row level security;
-- Läsning: föräldern ser sina egna barn; ledare/kommun ser föreningens barn.
-- Skrivning sker bara via SECURITY DEFINER-RPC:er nedan (ingen write-policy).
drop policy if exists child_select on public.child;
create policy child_select on public.child for select to authenticated
  using (parent_user_id = auth.uid() or private.has_forening_role(forening_id, 'ledare'));
grant select on public.child to authenticated;

-- ---------- koppla incheckningar/poäng till ett barn ----------
alter table public.checkin       add column if not exists child_id uuid references public.child(id) on delete cascade;
alter table public.points_ledger add column if not exists child_id uuid references public.child(id) on delete cascade;
create index if not exists idx_checkin_child on public.checkin(child_id, created_at desc);

-- points_ledger-triggern måste kreditera barnet när child_id är satt.
create or replace function public.apply_ledger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.child_id is not null then
    update public.child set points = points + new.delta where id = new.child_id;
  else
    update public.membership set points = points + new.delta
     where user_id = new.user_id and forening_id = new.forening_id;
  end if;
  return new;
end $$;

-- Mål-uppdrag ska INTE fyllas av barn-incheckningar (barn har inga uppdrag än),
-- så triggern hoppar över rader med child_id.
drop trigger if exists on_checkin_bump on public.checkin;
create trigger on_checkin_bump after insert on public.checkin
  for each row when (new.pending is not true and new.child_id is null)
  execute function public.bump_auto_missions();

-- ---------- gå med som ungdom ELLER förälder ----------
drop function if exists public.join_forening_by_code(text);
create or replace function public.join_forening_by_code(p_code text, p_role text default 'ungdom')
returns public.membership language plpgsql security definer set search_path = '' as $$
declare
  f public.forening;
  m public.membership;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if p_role not in ('ungdom', 'foralder') then raise exception 'Ogiltig roll'; end if;

  select * into f from public.forening where join_code = upper(trim(p_code));
  if not found then raise exception 'Ogiltig föreningskod'; end if;

  insert into public.membership (user_id, forening_id, role)
  values (auth.uid(), f.id, p_role::public.app_role)
  on conflict (user_id, forening_id) do update set forening_id = excluded.forening_id  -- no-op; behåller befintlig roll
  returning * into m;

  return m;
end $$;
grant execute on function public.join_forening_by_code(text, text) to authenticated;

-- ---------- barn-CRUD (bara föräldern själv) ----------
create or replace function public.add_child(p_forening uuid, p_name text, p_birth_year int default null, p_color text default '#6c4cf1')
returns public.child language plpgsql security definer set search_path = '' as $$
declare c public.child;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not exists (
    select 1 from public.membership m
     where m.user_id = auth.uid() and m.forening_id = p_forening and m.role = 'foralder'
  ) then raise exception 'Bara föräldrar kan lägga till barn'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Skriv ett namn'; end if;

  insert into public.child (forening_id, parent_user_id, display_name, avatar_color, birth_year)
  values (p_forening, auth.uid(), trim(p_name), coalesce(nullif(trim(coalesce(p_color, '')), ''), '#6c4cf1'), p_birth_year)
  returning * into c;
  return c;
end $$;
grant execute on function public.add_child(uuid, text, int, text) to authenticated;

create or replace function public.update_child(p_child uuid, p_name text, p_birth_year int default null, p_color text default null)
returns public.child language plpgsql security definer set search_path = '' as $$
declare c public.child;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  select * into c from public.child where id = p_child and parent_user_id = auth.uid();
  if not found then raise exception 'Barnet finns inte'; end if;

  update public.child set
    display_name = coalesce(nullif(trim(coalesce(p_name, '')), ''), display_name),
    birth_year   = p_birth_year,
    avatar_color = coalesce(nullif(trim(coalesce(p_color, '')), ''), avatar_color)
  where id = p_child
  returning * into c;
  return c;
end $$;
grant execute on function public.update_child(uuid, text, int, text) to authenticated;

create or replace function public.remove_child(p_child uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  delete from public.child where id = p_child and parent_user_id = auth.uid();
  if not found then raise exception 'Barnet finns inte'; end if;
end $$;
grant execute on function public.remove_child(uuid) to authenticated;

-- Mina barn i en förening (med statistik).
create or replace function public.my_children(p_forening uuid)
returns table (id uuid, display_name text, avatar_color text, birth_year int, points int, xp int, level int, streak int, visits int)
language sql security definer set search_path = '' stable as $$
  select c.id, c.display_name, c.avatar_color, c.birth_year, c.points, c.xp, c.level, c.streak, c.visits
    from public.child c
   where c.parent_user_id = auth.uid() and c.forening_id = p_forening
   order by c.display_name;
$$;
grant execute on function public.my_children(uuid) to authenticated;

-- Ett barns incheckningshistorik (bara förälderns egna barn).
create or replace function public.child_checkins(p_child uuid)
returns table (id uuid, title text, awarded_points int, created_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select c.id, coalesce(c.title, a.title, 'Incheckning'), c.awarded_points, c.created_at
    from public.checkin c
    left join public.activity a on a.id = c.activity_id
   where c.child_id = p_child
     and exists (select 1 from public.child ch where ch.id = p_child and ch.parent_user_id = auth.uid())
   order by c.created_at desc
   limit 50;
$$;
grant execute on function public.child_checkins(uuid) to authenticated;

-- ---------- barn-incheckning: QR (kreditera barnet direkt) ----------
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

-- ---------- barn-incheckning: öppen aktivitet (utan QR) ----------
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

-- ---------- topplista: inkludera barn (highlighta förälderns egna barn) ----------
create or replace function public.leaderboard(p_forening uuid)
returns table (rank int, user_id uuid, name text, points int, avatar_color text, is_me boolean)
language sql security definer set search_path = '' stable as $$
  with entries as (
    select m.user_id,
           coalesce(nullif(p.display_name, ''), 'Medlem') as name,
           m.points,
           coalesce(p.avatar_color, '#6c4cf1') as avatar_color,
           (m.user_id = auth.uid()) as is_me
      from public.membership m
      join public.profiles p on p.id = m.user_id
     where m.forening_id = p_forening and m.role = 'ungdom'
    union all
    select null::uuid, coalesce(nullif(c.display_name, ''), 'Barn'), c.points, coalesce(c.avatar_color, '#6c4cf1'),
           (c.parent_user_id = auth.uid())
      from public.child c
     where c.forening_id = p_forening
    union all
    select null::uuid, d.name, d.points, d.avatar_color, false
      from public.leaderboard_demo d
     where d.forening_id = p_forening
  ), ranked as (
    select e.*, row_number() over (order by e.points desc, e.name asc) as rnk
      from entries e
  )
  select r.rnk::int, r.user_id, r.name, r.points::int, r.avatar_color, r.is_me
    from ranked r
   where private.can_access_forening(p_forening)
   order by r.rnk
   limit 30;
$$;
grant execute on function public.leaderboard(uuid) to authenticated;

-- ---------- ledarens listor: visa barnets namn (inte förälderns) ----------
create or replace function public.ledare_checkins_today(p_forening uuid)
returns table (name text, title text, points int, at timestamptz)
language sql security definer set search_path = '' stable as $$
  select coalesce(ch.display_name, nullif(p.display_name, ''), 'Medlem'),
         coalesce(c.title, a.title, 'Incheckning'),
         c.awarded_points,
         c.created_at
    from public.checkin c
    join public.profiles p on p.id = c.user_id
    left join public.child ch on ch.id = c.child_id
    left join public.activity a on a.id = c.activity_id
   where c.forening_id = p_forening and c.created_at::date = current_date
     and private.has_forening_role(p_forening, 'ledare')
   order by c.created_at desc;
$$;
grant execute on function public.ledare_checkins_today(uuid) to authenticated;

create or replace function public.ledare_recent_checkins(p_forening uuid, p_limit int default 30)
returns table (name text, title text, points int, at timestamptz, photo_url text)
language sql security definer set search_path = '' stable as $$
  select coalesce(ch.display_name, nullif(p.display_name, ''), 'Medlem'),
         coalesce(c.title, a.title, 'Incheckning'),
         c.awarded_points, c.created_at, c.photo_url
    from public.checkin c
    join public.profiles p on p.id = c.user_id
    left join public.child ch on ch.id = c.child_id
    left join public.activity a on a.id = c.activity_id
   where c.forening_id = p_forening
     and private.has_forening_role(p_forening, 'ledare')
   order by c.created_at desc
   limit greatest(p_limit, 1);
$$;
grant execute on function public.ledare_recent_checkins(uuid, int) to authenticated;

-- =====================================================================
-- LEVLA — 0024 säkerhetshärdning inför lansering
--
-- Åtgärdar fynd från säkerhets-/GDPR-revisionen:
--   K1/H1  Geofencen kunde kringgås genom att skicka null-koordinater till
--          check_in / check_out / check_in_child. Nu KRÄVS koordinater när
--          aktiviteten/föreningen har en plats.
--   K2     dev_seed_me / dev_ready_missions var öppna för alla inloggade och
--          lät vem som helst ge sig själv poäng. Tas bort helt.
--   K3/H2  checkin-photos var en PUBLIK bucket med foton på minderåriga.
--          Görs privat + storleks-/typgräns; foton serveras via signerade
--          URL:er (klienten uppdaterad i src/lib/photo.ts).
--   M1(storage) Insert-policyn saknade ägarkontroll — vem som helst kunde
--          ladda upp till andras mapp. Nu scopat till egen uid-mapp.
--   H1(foto) p_photo_url validerades aldrig — vilken sträng som helst dög som
--          "fotobevis". Nu måste den peka på en fil i användarens egen mapp.
--   M1(RLS) Alla medlemmar kunde läsa alla andras membership-rader (poäng,
--          streak, besök). Begränsas till egen rad + ledare/kommun.
--   L3     redeem_reward låste belöningsraden men inte medlemsraden → två
--          samtidiga uttag kunde ge negativt saldo. Nu låses membership också.
--   A5     leaderboard() blandade in fejkade demo-konkurrenter i skarp drift.
--          Demo-unionen tas bort.
--
-- Idempotent: kan köras om — men BARA så länge databasen inte gått vidare
-- förbi 0031. Se spärren nedan.
-- =====================================================================

-- ---------------------------------------------------------------------
-- SPÄRR — kör inte den här filen på en databas som redan har XP-ekonomin.
--
-- 0031 gjorde om leaderboard() så att den rankar på säsongens XP i stället
-- för på poängsaldot. Den här filen definierar den gamla poängversionen, och
-- en omkörning skulle alltså tyst nedgradera topplistan och få appen att läsa
-- en kolumn som inte längre finns. Postgres vägrar redan av egen kraft
-- ("cannot change return type of existing function") — det här ger samma
-- besked på svenska, innan halva filen hunnit köra.
-- ---------------------------------------------------------------------
do $$
begin
  if to_regclass('public.xp_ledger') is not null then
    raise exception 'Databasen är redan uppdaterad förbi den här migrationen (xp_ledger finns, dvs. 0031 är körd). Kör INTE om 0024 — den skulle ersätta säsongstopplistan med den gamla poängversionen. Kör supabase/diagnostik.sql för att se vad som saknas.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- K2 — stäng dev-/fuskfunktionerna för appanvändare.
-- Vi DROPar dem inte (då slutar det dokumenterade testflödet fungera) utan
-- återkallar EXECUTE från app-rollerna. Kvar går att köra från SQL-editorn
-- (som ägaren postgres) vid test — men anon-nyckeln/JWT kan inte anropa dem,
-- så en användare kan inte längre ge sig själv poäng.
-- ---------------------------------------------------------------------
revoke execute on function public.dev_seed_me(uuid) from anon, authenticated, public;
revoke execute on function public.dev_ready_missions(uuid) from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- K3/H2 + M1(storage) — privat fotobucket, ägar-scoped upp-/nedladdning
-- ---------------------------------------------------------------------
update storage.buckets
   set public = false,
       file_size_limit = 5242880,                                   -- 5 MB
       allowed_mime_types = array['image/jpeg','image/png','image/webp']
 where id = 'checkin-photos';

-- Läsning: ägaren (första mappsegmentet = uid) eller en ledare i den förening
-- där incheckningen ligger. Inga anonyma läsningar.
drop policy if exists checkin_photos_read on storage.objects;
create policy checkin_photos_read on storage.objects for select to authenticated
  using (
    bucket_id = 'checkin-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.checkin c
         where (c.photo_url = name or c.photo_url like '%' || name)
           and private.has_forening_role(c.forening_id, 'ledare')
      )
    )
  );

-- Uppladdning: bara till den egna uid-mappen.
drop policy if exists checkin_photos_insert on storage.objects;
create policy checkin_photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'checkin-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------
-- M1(RLS) — membership: bara egen rad + ledare/kommun (inte alla co-medlemmar)
-- Topplista/ledarvyer går via SECURITY DEFINER-funktioner och påverkas inte.
-- ---------------------------------------------------------------------
drop policy if exists membership_select on public.membership;
create policy membership_select on public.membership for select to authenticated
  using (user_id = auth.uid() or private.has_forening_role(forening_id, 'ledare'));

-- ---------------------------------------------------------------------
-- K1/H1 — check_in: kräv koordinater när platsen finns (annars geo-bypass)
-- (Baserad på 0019; enda ändringen är geofence-villkoret.)
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

  if not a.continuous and a.starts_at is not null and a.duration_min is not null
     and (now() < a.starts_at - interval '15 minutes' or now() > a.starts_at + make_interval(mins => a.duration_min)) then
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
-- K1/H1 — check_out: kräv koordinater när platsen finns
-- (Baserad på 0019; enda ändringen är geofence-villkoret.)
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
-- K1/H1 — check_in_child: kräv koordinater när platsen finns
-- (Baserad på 0023; enda ändringen är geofence-villkoret.)
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

  if not a.continuous and a.starts_at is not null and a.duration_min is not null
     and (now() < a.starts_at - interval '15 minutes' or now() > a.starts_at + make_interval(mins => a.duration_min)) then
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
-- H1(foto) — open_checkin: validera att p_photo_url ligger i egen mapp
-- (Baserad på 0019; kräver redan koordinater. Endast fotokontrollen ändrad.)
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
-- H1(foto) — open_checkin_child: validera att p_photo_url ligger i egen mapp
-- (Baserad på 0023; kräver redan koordinater. Endast fotokontrollen ändrad.)
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
-- L3 — redeem_reward: lås även medlemsraden (annars kan samtidiga uttag
-- av OLIKA belöningar båda passera saldokontrollen → negativt saldo).
-- (Baserad på 0017; enda ändringen är "for update" på membership.)
-- ---------------------------------------------------------------------
create or replace function public.redeem_reward(p_reward_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r     public.reward;
  m     public.membership;
  taken int;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;

  select * into r from public.reward where id = p_reward_id and active = true for update;
  if not found then raise exception 'Belöningen finns inte'; end if;

  select * into m from public.membership
   where user_id = auth.uid() and forening_id = r.forening_id for update;
  if not found then raise exception 'Du är inte medlem i den här föreningen'; end if;

  if exists (
    select 1 from public.redemption
     where user_id = auth.uid() and reward_id = r.id
  ) then
    raise exception 'Redan uttagen';
  end if;

  if r.stock is not null then
    select count(*)::int into taken from public.redemption where reward_id = r.id;
    if taken >= r.stock then raise exception 'Slut — alla % är uttagna', r.stock; end if;
  end if;

  if m.points < r.cost then raise exception 'Inte tillräckligt med poäng'; end if;

  insert into public.redemption (forening_id, user_id, reward_id, cost)
  values (r.forening_id, auth.uid(), r.id, r.cost);

  insert into public.points_ledger (forening_id, user_id, delta, reason)
  values (r.forening_id, auth.uid(), -r.cost, 'redeem:' || r.id::text);

  return jsonb_build_object('cost', r.cost, 'title', r.title, 'points_left', m.points - r.cost);
end $$;
grant execute on function public.redeem_reward(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- A5 — leaderboard: ta bort fejkade demo-konkurrenter i skarp drift.
-- (Baserad på 0023; demo-unionen borttagen.)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- GDPR art 17 — radera mitt konto.
-- 1) Ta bort användarens uppladdade foton ur storage (dessa cascade:ar INTE
--    med checkin-raderna, så utan detta blir de kvarlämnade som föräldralösa).
-- 2) Radera auth.users-raden; alla domänrader (profiles, membership, checkin,
--    points_ledger, redemption, notification, mission_progress, push_token,
--    child + barnets rader) försvinner via ON DELETE CASCADE.
-- Kör som ägare (definer).
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Ej inloggad'; end if;

  delete from storage.objects
   where bucket_id = 'checkin-photos'
     and (storage.foldername(name))[1] = uid::text;

  delete from auth.users where id = uid;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

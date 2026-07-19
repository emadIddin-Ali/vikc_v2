-- =====================================================================
-- LEVLA — 0003 server-validated QR check-in + points/level/streak engine
-- The client sends only a QR token + its coordinates. The SERVER validates
-- (membership + QR + geofence + duplicate window) and owns all point awards.
-- =====================================================================

-- Haversine distance in meters between two lat/lng points.
create or replace function public.distance_m(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
) returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Perform a check-in. Returns a jsonb result describing the award.
-- Raises a friendly (Swedish) exception on any validation failure.
create or replace function public.check_in(
  p_qr_token text,
  p_lat double precision default null,
  p_lng double precision default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a           public.activity;
  f           public.forening;
  m           public.membership;
  v_lat       double precision;
  v_lng       double precision;
  dist        double precision;
  award_pts   integer;
  award_xp    integer;
  new_xp      integer;
  new_level   integer;
  leveled     boolean := false;
  xp_max      constant integer := 1000;
  last_visit  date;
  new_streak  integer;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;

  -- 1. QR must map to an active activity
  select * into a from public.activity where qr_token = p_qr_token and active = true;
  if not found then raise exception 'Ogiltig eller inaktiv QR-kod'; end if;

  select * into f from public.forening where id = a.forening_id;

  -- 2. Caller must be a member of that activity's förening
  select * into m from public.membership
   where user_id = auth.uid() and forening_id = a.forening_id;
  if not found then raise exception 'Du är inte medlem i den här föreningen'; end if;

  -- 3. Geofence: device coords must be within the venue radius (when coords exist)
  v_lat := coalesce(a.lat, f.lat);
  v_lng := coalesce(a.lng, f.lng);
  if v_lat is not null and v_lng is not null and p_lat is not null and p_lng is not null then
    dist := public.distance_m(p_lat, p_lng, v_lat, v_lng);
    if dist > f.geofence_radius_m then
      raise exception 'Du är för långt bort (% m från platsen)', round(dist)::int;
    end if;
  end if;

  -- 4. Anti-spam: no repeat check-in on the same activity within 8 hours
  if exists (
    select 1 from public.checkin c
     where c.user_id = auth.uid() and c.activity_id = a.id
       and c.created_at > now() - interval '8 hours'
  ) then
    raise exception 'Du har redan checkat in här nyligen';
  end if;

  award_pts := a.points;
  award_xp  := a.points;

  -- 5. XP + level (carry remainder across level-ups)
  new_xp := m.xp + award_xp;
  new_level := m.level;
  while new_xp >= xp_max loop
    new_xp := new_xp - xp_max;
    new_level := new_level + 1;
    leveled := true;
  end loop;

  -- 6. Streak from the most recent prior check-in date
  select max(c.created_at::date) into last_visit
    from public.checkin c
   where c.user_id = auth.uid() and c.forening_id = a.forening_id;
  if last_visit is null then
    new_streak := 1;
  elsif last_visit = current_date then
    new_streak := greatest(m.streak, 1);
  elsif last_visit = current_date - 1 then
    new_streak := m.streak + 1;
  else
    new_streak := 1;
  end if;

  -- 7. Record check-in + points (ledger trigger updates membership.points)
  insert into public.checkin (forening_id, user_id, activity_id, title, awarded_points, awarded_xp)
  values (a.forening_id, auth.uid(), a.id, a.title, award_pts, award_xp);

  insert into public.points_ledger (forening_id, user_id, delta, reason)
  values (a.forening_id, auth.uid(), award_pts, 'checkin:' || a.id::text);

  update public.membership
     set xp = new_xp, level = new_level, streak = new_streak, visits = visits + 1
   where id = m.id;

  return jsonb_build_object(
    'awarded_points', award_pts,
    'awarded_xp',     award_xp,
    'level',          new_level,
    'leveled_up',     leveled,
    'title',          a.title,
    'forening',       f.name
  );
end $$;

grant execute on function public.check_in(text, double precision, double precision) to authenticated;

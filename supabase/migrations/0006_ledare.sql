-- =====================================================================
-- LEVLA — 0006 leader tools (publish activity, manual attendance, KPIs)
-- All functions are gated on the caller having the 'ledare' role in the
-- förening (kommun-admins count as ledare via has_forening_role).
-- =====================================================================

-- Publish an activity and fan out an in-app notification to the förening's youth.
create or replace function public.publish_activity(
  p_forening uuid,
  p_title    text,
  p_when     text,
  p_points   int,
  p_place    text,
  p_theme    text,
  p_lat      double precision default null,
  p_lng      double precision default null
) returns public.activity language plpgsql security definer set search_path = '' as $$
declare a public.activity;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not private.has_forening_role(p_forening, 'ledare') then
    raise exception 'Endast ledare kan publicera aktiviteter';
  end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Skriv ett namn'; end if;

  insert into public.activity (forening_id, title, when_text, points, place_label, theme, lat, lng, created_by)
  values (
    p_forening, trim(p_title), nullif(trim(coalesce(p_when, '')), ''),
    coalesce(p_points, 30), nullif(trim(coalesce(p_place, '')), ''),
    coalesce(nullif(trim(coalesce(p_theme, '')), ''), 'fika'), p_lat, p_lng, auth.uid()
  )
  returning * into a;

  insert into public.notification (forening_id, user_id, icon, tint, title, body)
  select p_forening, mem.user_id, 'target', '#ede7ff',
         'Ny aktivitet: ' || a.title,
         coalesce(a.when_text || ' · ', '') || '+' || a.points::text || ' poäng · checka in på plats'
    from public.membership mem
   where mem.forening_id = p_forening and mem.role = 'ungdom';

  return a;
end $$;
grant execute on function public.publish_activity(uuid, text, text, int, text, text, double precision, double precision) to authenticated;

-- Mark a youth present → award 30 points/XP instantly (once per day).
create or replace function public.mark_present(p_forening uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m         public.membership;
  award     constant int := 30;
  xp_max    constant int := 1000;
  new_xp    int;
  new_level int;
  leveled   boolean := false;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not private.has_forening_role(p_forening, 'ledare') then
    raise exception 'Endast ledare kan ta närvaro';
  end if;

  select * into m from public.membership
   where user_id = p_user and forening_id = p_forening and role = 'ungdom';
  if not found then raise exception 'Ungdomen finns inte i föreningen'; end if;

  if exists (
    select 1 from public.checkin c
     where c.user_id = p_user and c.forening_id = p_forening
       and c.title = 'Närvaro' and c.created_at::date = current_date
  ) then
    raise exception 'Redan markerad idag';
  end if;

  new_xp := m.xp + award;
  new_level := m.level;
  while new_xp >= xp_max loop
    new_xp := new_xp - xp_max; new_level := new_level + 1; leveled := true;
  end loop;

  insert into public.checkin (forening_id, user_id, title, awarded_points, awarded_xp)
  values (p_forening, p_user, 'Närvaro', award, award);
  insert into public.points_ledger (forening_id, user_id, delta, reason)
  values (p_forening, p_user, award, 'attendance');
  update public.membership set xp = new_xp, level = new_level, visits = visits + 1 where id = m.id;

  return jsonb_build_object('awarded', award, 'level', new_level, 'leveled_up', leveled);
end $$;
grant execute on function public.mark_present(uuid, uuid) to authenticated;

-- Youth roster for the attendance view (name, avatar, visits, present today).
create or replace function public.ledare_youth(p_forening uuid)
returns table (user_id uuid, name text, avatar_color text, visits int, present_today boolean)
language sql security definer set search_path = '' stable as $$
  select m.user_id,
         coalesce(nullif(p.display_name, ''), 'Medlem'),
         coalesce(p.avatar_color, '#6c4cf1'),
         m.visits,
         exists (
           select 1 from public.checkin c
            where c.user_id = m.user_id and c.forening_id = p_forening
              and c.title = 'Närvaro' and c.created_at::date = current_date
         )
    from public.membership m
    join public.profiles p on p.id = m.user_id
   where m.forening_id = p_forening and m.role = 'ungdom'
     and private.has_forening_role(p_forening, 'ledare')
   order by p.display_name nulls last;
$$;
grant execute on function public.ledare_youth(uuid) to authenticated;

-- Overview KPIs for the leader dashboard.
create or replace function public.ledare_overview(p_forening uuid)
returns jsonb language sql security definer set search_path = '' stable as $$
  select case when not private.has_forening_role(p_forening, 'ledare')
    then jsonb_build_object('checked_today', 0, 'awarded_today', 0, 'youth', 0, 'activities', 0)
    else jsonb_build_object(
      'checked_today', (select count(*) from public.checkin c
                          where c.forening_id = p_forening and c.created_at::date = current_date),
      'awarded_today', (select coalesce(sum(c.awarded_points), 0) from public.checkin c
                          where c.forening_id = p_forening and c.created_at::date = current_date),
      'youth',         (select count(*) from public.membership m
                          where m.forening_id = p_forening and m.role = 'ungdom'),
      'activities',    (select count(*) from public.activity a where a.forening_id = p_forening)
    ) end;
$$;
grant execute on function public.ledare_overview(uuid) to authenticated;

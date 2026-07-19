-- =====================================================================
-- LEVLA — 0007 leader improvements
--  * attendance can target a specific activity (right points + record)
--  * dashboard drill-down: who checked in today (name + activity)
-- =====================================================================

-- mark_present now takes an optional activity: award that activity's points
-- and record it; otherwise fall back to a flat +30 "Närvaro".
drop function if exists public.mark_present(uuid, uuid);
create or replace function public.mark_present(p_forening uuid, p_user uuid, p_activity uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  m         public.membership;
  a         public.activity;
  award     int;
  ttl       text;
  act_id    uuid;
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

  if p_activity is not null then
    select * into a from public.activity where id = p_activity and forening_id = p_forening;
    if not found then raise exception 'Aktiviteten finns inte'; end if;
    award := a.points; ttl := a.title; act_id := a.id;
  else
    award := 30; ttl := 'Närvaro'; act_id := null;
  end if;

  if exists (
    select 1 from public.checkin c
     where c.user_id = p_user and c.forening_id = p_forening and c.created_at::date = current_date
       and ((act_id is not null and c.activity_id = act_id) or (act_id is null and c.title = 'Närvaro'))
  ) then
    raise exception 'Redan markerad idag';
  end if;

  new_xp := m.xp + award;
  new_level := m.level;
  while new_xp >= xp_max loop
    new_xp := new_xp - xp_max; new_level := new_level + 1; leveled := true;
  end loop;

  insert into public.checkin (forening_id, user_id, activity_id, title, awarded_points, awarded_xp)
  values (p_forening, p_user, act_id, ttl, award, award);
  insert into public.points_ledger (forening_id, user_id, delta, reason)
  values (p_forening, p_user, award, 'attendance');
  update public.membership set xp = new_xp, level = new_level, visits = visits + 1 where id = m.id;

  return jsonb_build_object('awarded', award, 'level', new_level, 'leveled_up', leveled);
end $$;
grant execute on function public.mark_present(uuid, uuid, uuid) to authenticated;

-- ledare_youth now reports "present" relative to the selected activity.
drop function if exists public.ledare_youth(uuid);
create or replace function public.ledare_youth(p_forening uuid, p_activity uuid default null)
returns table (user_id uuid, name text, avatar_color text, visits int, present_today boolean)
language sql security definer set search_path = '' stable as $$
  select m.user_id,
         coalesce(nullif(p.display_name, ''), 'Medlem'),
         coalesce(p.avatar_color, '#6c4cf1'),
         m.visits,
         exists (
           select 1 from public.checkin c
            where c.user_id = m.user_id and c.forening_id = p_forening and c.created_at::date = current_date
              and ((p_activity is not null and c.activity_id = p_activity)
                   or (p_activity is null and c.title = 'Närvaro'))
         )
    from public.membership m
    join public.profiles p on p.id = m.user_id
   where m.forening_id = p_forening and m.role = 'ungdom'
     and private.has_forening_role(p_forening, 'ledare')
   order by p.display_name nulls last;
$$;
grant execute on function public.ledare_youth(uuid, uuid) to authenticated;

-- Today's check-ins (name + which activity) for the dashboard drill-down.
create or replace function public.ledare_checkins_today(p_forening uuid)
returns table (name text, title text, points int, at timestamptz)
language sql security definer set search_path = '' stable as $$
  select coalesce(nullif(p.display_name, ''), 'Medlem'),
         coalesce(c.title, a.title, 'Incheckning'),
         c.awarded_points,
         c.created_at
    from public.checkin c
    join public.profiles p on p.id = c.user_id
    left join public.activity a on a.id = c.activity_id
   where c.forening_id = p_forening and c.created_at::date = current_date
     and private.has_forening_role(p_forening, 'ledare')
   order by c.created_at desc;
$$;
grant execute on function public.ledare_checkins_today(uuid) to authenticated;

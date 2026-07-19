-- =====================================================================
-- LEVLA — 0004 missions (claim) + shop (redeem)
-- Server-owned: claiming/redeeming validate membership + eligibility and
-- move points through points_ledger (the trigger keeps membership.points).
-- =====================================================================

-- Claim a completed mission → award XP + points, lock it.
create or replace function public.claim_mission(p_mission_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  mi         public.mission;
  m          public.membership;
  prog       public.mission_progress;
  award      integer;
  new_xp     integer;
  new_level  integer;
  leveled    boolean := false;
  xp_max     constant integer := 1000;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;

  select * into mi from public.mission where id = p_mission_id and active = true;
  if not found then raise exception 'Uppdraget finns inte'; end if;

  select * into m from public.membership
   where user_id = auth.uid() and forening_id = mi.forening_id;
  if not found then raise exception 'Du är inte medlem i den här föreningen'; end if;

  select * into prog from public.mission_progress
   where mission_id = mi.id and user_id = auth.uid();
  if not found or prog.progress < mi.goal then
    raise exception 'Uppdraget är inte klart än';
  end if;
  if prog.done then raise exception 'Redan inlöst'; end if;

  award := mi.xp;

  new_xp := m.xp + award;
  new_level := m.level;
  while new_xp >= xp_max loop
    new_xp := new_xp - xp_max;
    new_level := new_level + 1;
    leveled := true;
  end loop;

  insert into public.points_ledger (forening_id, user_id, delta, reason)
  values (mi.forening_id, auth.uid(), award, 'mission:' || mi.id::text);

  update public.membership set xp = new_xp, level = new_level where id = m.id;
  update public.mission_progress set done = true where id = prog.id;

  return jsonb_build_object(
    'awarded_xp', award, 'awarded_points', award,
    'level', new_level, 'leveled_up', leveled
  );
end $$;
grant execute on function public.claim_mission(uuid) to authenticated;

-- Redeem a reward → subtract its cost, record the redemption (one-time per reward).
create or replace function public.redeem_reward(p_reward_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r  public.reward;
  m  public.membership;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;

  select * into r from public.reward where id = p_reward_id and active = true;
  if not found then raise exception 'Belöningen finns inte'; end if;

  select * into m from public.membership
   where user_id = auth.uid() and forening_id = r.forening_id;
  if not found then raise exception 'Du är inte medlem i den här föreningen'; end if;

  if exists (
    select 1 from public.redemption
     where user_id = auth.uid() and reward_id = r.id
  ) then
    raise exception 'Redan uttagen';
  end if;

  if m.points < r.cost then raise exception 'Inte tillräckligt med poäng'; end if;

  insert into public.redemption (forening_id, user_id, reward_id, cost)
  values (r.forening_id, auth.uid(), r.id, r.cost);

  insert into public.points_ledger (forening_id, user_id, delta, reason)
  values (r.forening_id, auth.uid(), -r.cost, 'redeem:' || r.id::text);

  return jsonb_build_object('cost', r.cost, 'title', r.title, 'points_left', m.points - r.cost);
end $$;
grant execute on function public.redeem_reward(uuid) to authenticated;

-- DEV ONLY: mark all of a förening's missions as complete (progress = goal) for the
-- current user, so the claim flow is testable. Safe to re-run.
create or replace function public.dev_ready_missions(p_forening uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  insert into public.mission_progress (mission_id, forening_id, user_id, progress, done)
  select mi.id, mi.forening_id, auth.uid(), mi.goal, false
    from public.mission mi
   where mi.forening_id = p_forening and mi.active = true
  on conflict (mission_id, user_id) do update
    set progress = excluded.progress, done = false;
end $$;
grant execute on function public.dev_ready_missions(uuid) to authenticated;

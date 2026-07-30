-- =====================================================================
-- LEVLA — 0018 uppdrag v2: två tydliga typer (Mål vs Uppgift)
--
-- Problemet förut: varje uppdrag hade en "auto_visit"-flagga. Var den på
-- fylldes uppdraget av VARJE incheckning — så en aktivitet räknades tyst
-- som ett uppdrag och gränsen mellan aktivitet och uppdrag suddades ut.
-- Var den av fanns det inget sätt alls att göra klart uppdraget (bara
-- dev-funktionen kunde flytta progressen), så "manuella" uppdrag var döda.
--
-- Nu har varje uppdrag en TYP:
--   * 'goal' (Mål)     — fylls automatiskt av incheckningar och löses in
--                        när stapeln är full (gamla auto_visit = true).
--   * 'task' (Uppgift) — något ungdomen aktivt gör och markerar klart för
--                        att få XP direkt (gamla auto_visit = false, som
--                        förut aldrig kunde bli klara).
-- =====================================================================

-- ---------- schema: mission.kind ersätter auto_visit ----------
alter table public.mission add column if not exists kind text;

-- Backfilla typ ur den gamla flaggan innan den tas bort.
update public.mission
   set kind = case when coalesce(auto_visit, false) then 'goal' else 'task' end
 where kind is null;

alter table public.mission alter column kind set default 'goal';
alter table public.mission alter column kind set not null;
alter table public.mission drop constraint if exists mission_kind_check;
alter table public.mission add constraint mission_kind_check check (kind in ('goal','task'));

-- auto_visit är helt ersatt av kind. (Funktioner i plpgsql är sent bundna,
-- så att droppa kolumnen påverkar inte triggern förrän den körs — och vi
-- definierar om den här nedan så den aldrig läser auto_visit igen.)
alter table public.mission drop column if exists auto_visit;

-- ---------- trigger: 'goal'-uppdrag fylls +1 vid varje incheckning ----------
create or replace function public.bump_auto_missions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.mission_progress (mission_id, forening_id, user_id, progress, done)
  select mi.id, mi.forening_id, new.user_id, 1, false
    from public.mission mi
   where mi.forening_id = new.forening_id and mi.active and mi.kind = 'goal'
  on conflict (mission_id, user_id) do update set progress = mission_progress.progress + 1;
  return new;
end $$;
-- (Triggern on_checkin_bump från 0009 pekar redan på den här funktionen.)

-- ---------- claim_mission v2: bara för Mål ('goal') ----------
-- Ett Mål löses in när progressen nått målet. Tasks går INTE via den här
-- vägen — de har en egen funktion (complete_task) så inget kan dubbeltas ut.
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

  select * into mi from public.mission where id = p_mission_id and active = true and kind = 'goal';
  if not found then raise exception 'Målet finns inte'; end if;

  select * into m from public.membership
   where user_id = auth.uid() and forening_id = mi.forening_id;
  if not found then raise exception 'Du är inte medlem i den här föreningen'; end if;

  select * into prog from public.mission_progress
   where mission_id = mi.id and user_id = auth.uid();
  if not found or prog.progress < mi.goal then
    raise exception 'Målet är inte klart än';
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

-- ---------- complete_task: markera en Uppgift klar → XP direkt ----------
-- Uppgifter är självrapporterade (t.ex. "Städa efter dig", "Hjälp en
-- kompis"): ungdomen trycker klart och får XP direkt. En uppgift kan bara
-- tas ut en gång per medlem (mission_progress.done låser den).
create or replace function public.complete_task(p_mission_id uuid)
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

  select * into mi from public.mission where id = p_mission_id and active = true and kind = 'task';
  if not found then raise exception 'Uppgiften finns inte'; end if;

  select * into m from public.membership
   where user_id = auth.uid() and forening_id = mi.forening_id;
  if not found then raise exception 'Du är inte medlem i den här föreningen'; end if;

  select * into prog from public.mission_progress
   where mission_id = mi.id and user_id = auth.uid();
  if found and prog.done then raise exception 'Redan klar'; end if;

  award := mi.xp;
  new_xp := m.xp + award;
  new_level := m.level;
  while new_xp >= xp_max loop
    new_xp := new_xp - xp_max;
    new_level := new_level + 1;
    leveled := true;
  end loop;

  insert into public.points_ledger (forening_id, user_id, delta, reason)
  values (mi.forening_id, auth.uid(), award, 'task:' || mi.id::text);

  update public.membership set xp = new_xp, level = new_level where id = m.id;

  insert into public.mission_progress (mission_id, forening_id, user_id, progress, done)
  values (mi.id, mi.forening_id, auth.uid(), greatest(mi.goal, 1), true)
  on conflict (mission_id, user_id) do update set progress = excluded.progress, done = true;

  return jsonb_build_object(
    'awarded_xp', award, 'awarded_points', award,
    'level', new_level, 'leveled_up', leveled, 'title', mi.title
  );
end $$;
grant execute on function public.complete_task(uuid) to authenticated;

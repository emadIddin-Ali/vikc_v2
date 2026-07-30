-- =====================================================================
-- LEVLA — 0031 poängekonomin: XP-huvudbok, säsonger, veckosvit, veckomål
--
-- Fyra fel i den gamla ekonomin:
--
--   1. TOPPLISTAN RANKADE PÅ POÄNG, alltså på det SPENDERBARA saldot. Den
--      som handlade i butiken tappade placering — appen straffade exakt det
--      beteende den är byggd för. Med marknad varannan månad blev det värre:
--      listan mätte i praktiken vem som ännu inte hunnit handla.
--
--   2. POÄNG OCH XP VAR SAMMA TAL. Varje källa skrev samma siffra till både
--      points_ledger och membership.xp, så nivån sa ingenting som poängen
--      inte redan sagt. Nu gäller: POÄNG tjänas genom att komma (incheckning)
--      och spenderas i butiken. XP tjänas genom att prestera (uppdrag,
--      stjärnor, märken, veckomål) och kan aldrig spenderas.
--
--   3. XP SAKNADE HUVUDBOK. Bara ett cachat tal fanns, så frågan "hur mycket
--      XP fick jag den här veckan" gick inte att svara på — vilket blockerade
--      säsonger, veckomål och rättelser. xp_ledger löser det.
--
--   4. SVITEN RÄKNADES I DAGAR i en app vars föreningar är öppna två-tre
--      gånger i veckan. En daglig svit var matematiskt omöjlig att hålla och
--      siffran var därför död. Nu räknas VECKOR i rad, och sviten tål ett
--      hopp: missar du en vecka lever den vidare, missar du två börjar den om.
--
-- SÄSONG = perioden mellan två marknader. Topplistan nollställs när marknaden
-- öppnar, så rangordningen knyts till en verklig händelse. Har föreningen
-- inga marknader är säsongen kalendermånaden.
--
-- Ingen av de stora incheckningsfunktionerna skrivs om. XP fångas i stället
-- med triggers på checkin och stjarna — raderna finns redan och bär beloppet,
-- så huvudboken fylls utan att geofence, tidsfönster och fotokontroller
-- behöver röras.
--
-- INTE gjort: den stigande nivåkurvan. 1000 XP per nivå ligger hårdkodat i
-- sex SECURITY DEFINER-funktioner som var och en returnerar leveled_up till
-- nivå-upp-firandet. Att ändra kurvan utan att först samla all XP-utdelning i
-- EN funktion skulle få firandet att slå fel — den refaktoreringen förtjänar
-- en egen migration. Vinsten är rent kosmetisk tills någon når nivå 10.
--
-- Kräver 0030. Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. XP-huvudboken
-- ---------------------------------------------------------------------
create table if not exists public.xp_ledger (
  id          uuid primary key default gen_random_uuid(),
  forening_id uuid not null references public.forening(id) on delete cascade,
  -- För ett barn är user_id föräldern och child_id barnet, precis som i
  -- points_ledger och checkin.
  user_id     uuid not null references auth.users(id) on delete cascade,
  child_id    uuid references public.child(id) on delete cascade,
  delta       integer not null,
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_xp_ledger_user  on public.xp_ledger(forening_id, user_id, created_at desc);
create index if not exists idx_xp_ledger_child on public.xp_ledger(forening_id, child_id, created_at desc);

alter table public.xp_ledger enable row level security;
drop policy if exists xp_ledger_select on public.xp_ledger;
create policy xp_ledger_select on public.xp_ledger for select to authenticated
  using (
    user_id = auth.uid()
    or private.has_forening_role(forening_id, 'ledare')
    or exists (select 1 from public.child c where c.id = xp_ledger.child_id and c.parent_user_id = auth.uid())
  );
grant select on public.xp_ledger to authenticated;

create or replace function private.log_xp(
  p_forening uuid, p_user uuid, p_child uuid, p_delta int, p_reason text
) returns void language sql security definer set search_path = '' as $$
  insert into public.xp_ledger (forening_id, user_id, child_id, delta, reason)
  select p_forening, p_user, p_child, p_delta, p_reason where coalesce(p_delta, 0) <> 0;
$$;
grant execute on function private.log_xp(uuid, uuid, uuid, int, text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Veckosvit + veckomål
-- ---------------------------------------------------------------------
alter table public.membership add column if not exists week_streak integer not null default 0;
alter table public.child      add column if not exists week_streak integer not null default 0;

alter table public.forening
  add column if not exists week_goal        integer not null default 2,
  add column if not exists week_goal_xp     integer not null default 150,
  add column if not exists week_goal_points integer not null default 50;

alter table public.forening drop constraint if exists forening_week_goal_check;
alter table public.forening add constraint forening_week_goal_check
  check (week_goal >= 0 and week_goal_xp >= 0 and week_goal_points >= 0);

comment on column public.forening.week_goal is
  'Besök per vecka som ger veckobonusen. 0 = veckomålet är avstängt.';
comment on column public.membership.week_streak is
  'Veckor i rad med minst ett besök. Tål ett hopp. Räknas om av trigger, inte av incheckningsfunktionerna.';

-- Veckor i rad med minst ett besök, bakåt från det senaste besöket.
-- Ett (1) överhoppat mellanrum tillåts i hela kedjan — det är "frysningen",
-- fast härledd ur historiken i stället för lagrad som ett saldo att hålla reda på.
create or replace function private.veckosvit(p_forening uuid, p_user uuid, p_child uuid)
returns integer language plpgsql security definer set search_path = '' stable as $$
declare
  veckor date[];
  denna  date := date_trunc('week', now())::date;
  kollar date;
  aldst  date;
  svit   int := 0;
  hopp   int := 0;
begin
  select array_agg(q.v order by q.v desc) into veckor from (
    select distinct date_trunc('week', c.created_at)::date as v
      from public.checkin c
     where c.forening_id = p_forening
       and coalesce(c.pending, false) = false
       and case when p_child is null then c.user_id = p_user and c.child_id is null
                else c.child_id = p_child end
  ) q;

  if veckor is null then return 0; end if;
  -- Bruten om det senaste besöket ligger längre bak än förra veckan.
  if veckor[1] < denna - 7 then return 0; end if;

  aldst  := veckor[array_length(veckor, 1)];
  kollar := veckor[1];
  loop
    if kollar = any(veckor) then
      svit := svit + 1;
    else
      hopp := hopp + 1;
      exit when hopp > 1;
    end if;
    kollar := kollar - 7;
    exit when kollar < aldst;
  end loop;

  return svit;
end $$;
grant execute on function private.veckosvit(uuid, uuid, uuid) to authenticated;

-- Veckobonusen kvitteras en gång per vecka och elev.
create table if not exists public.week_goal_claim (
  id          uuid primary key default gen_random_uuid(),
  forening_id uuid not null references public.forening(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete cascade,
  child_id    uuid references public.child(id) on delete cascade,
  week_start  date not null,
  created_at  timestamptz not null default now()
);
create unique index if not exists uq_week_goal_user
  on public.week_goal_claim(forening_id, user_id, week_start) where user_id is not null;
create unique index if not exists uq_week_goal_child
  on public.week_goal_claim(forening_id, child_id, week_start) where child_id is not null;
alter table public.week_goal_claim enable row level security;
-- Ingen klientpolicy: raden är bara ett kvitto som triggern läser och skriver.

-- ---------------------------------------------------------------------
-- 3. Triggern som håller ihop det: XP till huvudboken, svit, veckomål
--
-- DEFERRABLE INITIALLY DEFERRED, alltså vid commit — inte direkt efter
-- INSERT. Det är avgörande: check_in() skriver raden i checkin FÖRST och
-- uppdaterar membership.xp/level EFTERÅT med värden den räknat ut i förväg.
-- En vanlig AFTER INSERT-trigger hade delat ut veckobonusens XP innan den
-- uppdateringen, och check_in hade sedan skrivit över den med sin egen
-- summa — bonusen hade tyst försvunnit. Vid commit har alla funktionens
-- egna skrivningar redan skett.
-- ---------------------------------------------------------------------
create or replace function public.on_checkin_ekonomi()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  f       public.forening;
  v_week  date := date_trunc('week', now())::date;
  antal   int;
  v_notify uuid;
  v_namn  text;
begin
  -- Väntande incheckningar ger inget förrän utcheckningen. Vid UPDATE är det
  -- bara övergången väntande → klar som räknas.
  if coalesce(new.pending, false) then return new; end if;
  if tg_op = 'UPDATE' and coalesce(old.pending, false) = false then return new; end if;

  if coalesce(new.awarded_xp, 0) <> 0 then
    perform private.log_xp(new.forening_id, new.user_id, new.child_id, new.awarded_xp,
                           'checkin:' || coalesce(new.activity_id::text, 'narvaro'));
  end if;

  if new.child_id is not null then
    update public.child set week_streak = private.veckosvit(new.forening_id, null, new.child_id)
     where id = new.child_id;
  else
    update public.membership set week_streak = private.veckosvit(new.forening_id, new.user_id, null)
     where user_id = new.user_id and forening_id = new.forening_id;
  end if;

  -- ---- veckomålet ----
  -- Triggern körs vid commit, så ett fel här skulle sänka hela incheckningen.
  -- Saknas raden att kreditera hoppar vi över bonusen i stället för att låta
  -- apply_xp kasta.
  if new.child_id is null and not exists (
       select 1 from public.membership m
        where m.user_id = new.user_id and m.forening_id = new.forening_id
     ) then return new; end if;

  select * into f from public.forening where id = new.forening_id;
  if coalesce(f.week_goal, 0) = 0 then return new; end if;

  select count(*) into antal from public.checkin c
   where c.forening_id = new.forening_id
     and coalesce(c.pending, false) = false
     and date_trunc('week', c.created_at)::date = v_week
     and case when new.child_id is null then c.user_id = new.user_id and c.child_id is null
              else c.child_id = new.child_id end;
  if antal < f.week_goal then return new; end if;

  insert into public.week_goal_claim (forening_id, user_id, child_id, week_start)
  values (new.forening_id, case when new.child_id is null then new.user_id end, new.child_id, v_week)
  on conflict do nothing;
  if not found then return new; end if;   -- redan kvitterat den här veckan

  if f.week_goal_xp > 0 then
    perform private.apply_xp(new.forening_id, new.user_id, new.child_id, f.week_goal_xp);
    perform private.log_xp(new.forening_id, new.user_id, new.child_id, f.week_goal_xp,
                           'veckomal:' || v_week::text);
  end if;
  if f.week_goal_points > 0 then
    insert into public.points_ledger (forening_id, user_id, child_id, delta, reason)
    values (new.forening_id, new.user_id, new.child_id, f.week_goal_points, 'veckomal:' || v_week::text);
  end if;

  if new.child_id is not null then
    select c.parent_user_id, coalesce(nullif(c.display_name, ''), 'Ditt barn')
      into v_notify, v_namn from public.child c where c.id = new.child_id;
  else
    v_notify := new.user_id;
  end if;
  if v_notify is not null then
    insert into public.notification (forening_id, user_id, icon, tint, title, body)
    values (new.forening_id, v_notify, 'target', '#dcfce7',
            case when v_namn is null then 'Veckans mål är klart!'
                 else v_namn || ' klarade veckans mål!' end,
            '+' || f.week_goal_xp || ' XP'
              || case when f.week_goal_points > 0 then ' och +' || f.week_goal_points || ' poäng' else '' end
              || ' för ' || f.week_goal || ' besök den här veckan.');
  end if;

  return new;
end $$;

-- Villkoren ligger i funktionskroppen, inte i en WHEN-klausul: en constraint-
-- trigger utvärderar WHEN vid commit och det är lättare att läsa så här.
drop trigger if exists on_checkin_ekonomi on public.checkin;
drop trigger if exists on_checkout_ekonomi on public.checkin;
create constraint trigger on_checkin_ekonomi
  after insert or update on public.checkin
  deferrable initially deferred
  for each row execute function public.on_checkin_ekonomi();

-- ---------------------------------------------------------------------
-- 4. Stjärnornas XP till huvudboken
-- Stjärnraden är redan en huvudbok — den bär beloppet och vet när det
-- delades ut och ångrades, så en trigger räcker och 0028 behöver inte röras.
-- ---------------------------------------------------------------------
create or replace function public.on_stjarna_xp()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.granted_at is not null and new.voided_at is null then
      perform private.log_xp(new.forening_id, coalesce(new.student_user_id, auth.uid()),
                             new.child_id, new.xp, 'stjarna:' || new.id::text);
    end if;
    return new;
  end if;

  -- Utdelad i och med att lektionen avslutades.
  if old.granted_at is null and new.granted_at is not null and new.voided_at is null then
    perform private.log_xp(new.forening_id, coalesce(new.student_user_id, auth.uid()),
                           new.child_id, new.xp, 'stjarna:' || new.id::text);
  end if;

  -- Ångrad: motbokning, aldrig radering.
  if old.voided_at is null and new.voided_at is not null and new.granted_at is not null then
    perform private.log_xp(new.forening_id, coalesce(new.student_user_id, auth.uid()),
                           new.child_id, -new.xp, 'stjarna-angrad:' || new.id::text);
  end if;
  return new;
end $$;

drop trigger if exists on_stjarna_xp_insert on public.stjarna;
create trigger on_stjarna_xp_insert after insert on public.stjarna
  for each row execute function public.on_stjarna_xp();

drop trigger if exists on_stjarna_xp_update on public.stjarna;
create trigger on_stjarna_xp_update after update on public.stjarna
  for each row execute function public.on_stjarna_xp();

-- ---------------------------------------------------------------------
-- 5. Uppdrag ger XP, inte butikspoäng
-- En ledare som lägger upp ett uppdrag på 500 XP tryckte tidigare 500
-- butikskronor på köpet. Nu skiljs meriterna från valutan.
-- ---------------------------------------------------------------------
create or replace function public.claim_mission(p_mission_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  mi public.mission; m public.membership; prog public.mission_progress;
  award int; new_xp int; new_level int; leveled boolean := false; xp_max constant int := 1000;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;

  select * into mi from public.mission where id = p_mission_id and active = true and kind = 'goal';
  if not found then raise exception 'Målet finns inte'; end if;

  select * into m from public.membership where user_id = auth.uid() and forening_id = mi.forening_id;
  if not found then raise exception 'Du är inte medlem i den här föreningen'; end if;

  select * into prog from public.mission_progress where mission_id = mi.id and user_id = auth.uid();
  if not found or prog.progress < mi.goal then raise exception 'Målet är inte klart än'; end if;
  if prog.done then raise exception 'Redan inlöst'; end if;

  award := mi.xp;
  new_xp := m.xp + award; new_level := m.level;
  while new_xp >= xp_max loop new_xp := new_xp - xp_max; new_level := new_level + 1; leveled := true; end loop;

  perform private.log_xp(mi.forening_id, auth.uid(), null, award, 'mission:' || mi.id::text);
  update public.membership set xp = new_xp, level = new_level where id = m.id;
  update public.mission_progress set done = true where id = prog.id;

  return jsonb_build_object('awarded_xp', award, 'awarded_points', 0,
                            'level', new_level, 'leveled_up', leveled);
end $$;
grant execute on function public.claim_mission(uuid) to authenticated;

create or replace function public.complete_task(p_mission_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  mi public.mission; m public.membership; prog public.mission_progress;
  award int; new_xp int; new_level int; leveled boolean := false; xp_max constant int := 1000;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;

  select * into mi from public.mission where id = p_mission_id and active = true and kind = 'task';
  if not found then raise exception 'Uppgiften finns inte'; end if;

  select * into m from public.membership where user_id = auth.uid() and forening_id = mi.forening_id;
  if not found then raise exception 'Du är inte medlem i den här föreningen'; end if;

  select * into prog from public.mission_progress where mission_id = mi.id and user_id = auth.uid();
  if found and prog.done then raise exception 'Redan klar'; end if;

  award := mi.xp;
  new_xp := m.xp + award; new_level := m.level;
  while new_xp >= xp_max loop new_xp := new_xp - xp_max; new_level := new_level + 1; leveled := true; end loop;

  perform private.log_xp(mi.forening_id, auth.uid(), null, award, 'task:' || mi.id::text);
  update public.membership set xp = new_xp, level = new_level where id = m.id;

  insert into public.mission_progress (mission_id, forening_id, user_id, progress, done)
  values (mi.id, mi.forening_id, auth.uid(), greatest(mi.goal, 1), true)
  on conflict (mission_id, user_id) do update set progress = excluded.progress, done = true;

  return jsonb_build_object('awarded_xp', award, 'awarded_points', 0,
                            'level', new_level, 'leveled_up', leveled, 'title', mi.title);
end $$;
grant execute on function public.complete_task(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Säsongen — perioden mellan två marknader
-- ---------------------------------------------------------------------
create or replace function private.sasong_start(fid uuid)
returns timestamptz language sql security definer set search_path = '' stable as $$
  select coalesce(
    (select max(m.opens_at) from public.marknad m where m.forening_id = fid and m.opens_at <= now()),
    date_trunc('month', now())
  );
$$;
grant execute on function private.sasong_start(uuid) to authenticated;

create or replace function public.sasong_status(p_forening uuid)
returns jsonb language sql security definer set search_path = '' stable as $$
  select jsonb_build_object(
           'start', private.sasong_start(p_forening),
           'slut',  (select min(m.opens_at) from public.marknad m
                      where m.forening_id = p_forening and m.opens_at > now()),
           'marknadsstyrd', exists (select 1 from public.marknad m
                                     where m.forening_id = p_forening and m.opens_at <= now())
         )
   where private.can_access_forening(p_forening);
$$;
grant execute on function public.sasong_status(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Topplistan rankar på säsongens XP
-- ---------------------------------------------------------------------
drop function if exists public.leaderboard(uuid);
create or replace function public.leaderboard(p_forening uuid)
returns table (rank int, user_id uuid, name text, xp int, avatar_color text, is_me boolean)
language sql security definer set search_path = '' stable as $$
  with entries as (
    select m.user_id,
           coalesce(nullif(p.display_name, ''), 'Medlem') as name,
           (select coalesce(sum(x.delta), 0)::int from public.xp_ledger x
             where x.forening_id = p_forening and x.user_id = m.user_id and x.child_id is null
               and x.created_at >= private.sasong_start(p_forening)) as xp,
           coalesce(p.avatar_color, '#6c4cf1') as avatar_color,
           (m.user_id = auth.uid()) as is_me
      from public.membership m
      join public.profiles p on p.id = m.user_id
     where m.forening_id = p_forening and m.role = 'ungdom'
    union all
    select null::uuid,
           coalesce(nullif(c.display_name, ''), 'Barn'),
           (select coalesce(sum(x.delta), 0)::int from public.xp_ledger x
             where x.forening_id = p_forening and x.child_id = c.id
               and x.created_at >= private.sasong_start(p_forening)),
           coalesce(c.avatar_color, '#6c4cf1'),
           (c.parent_user_id = auth.uid())
      from public.child c
     where c.forening_id = p_forening
  ), ranked as (
    select e.*, row_number() over (order by e.xp desc, e.name asc) as rnk from entries e
  )
  select r.rnk::int, r.user_id, r.name, r.xp, r.avatar_color, r.is_me
    from ranked r
   where private.can_access_forening(p_forening)
   order by r.rnk
   limit 30;
$$;
grant execute on function public.leaderboard(uuid) to authenticated;

-- Förra säsongens pall. Ingen cron behövs — vinnarna räknas fram ur
-- huvudboken när någon öppnar topplistan.
create or replace function public.leaderboard_forra(p_forening uuid)
returns table (rank int, name text, xp int, avatar_color text)
language sql security definer set search_path = '' stable as $$
  with grans as (
    select private.sasong_start(p_forening) as slut,
           (select max(m.opens_at) from public.marknad m
             where m.forening_id = p_forening and m.opens_at < private.sasong_start(p_forening)) as start
  ), entries as (
    select coalesce(nullif(p.display_name, ''), 'Medlem') as name,
           (select coalesce(sum(x.delta), 0)::int from public.xp_ledger x, grans g
             where x.forening_id = p_forening and x.user_id = m.user_id and x.child_id is null
               and x.created_at >= g.start and x.created_at < g.slut) as xp,
           coalesce(p.avatar_color, '#6c4cf1') as avatar_color
      from public.membership m
      join public.profiles p on p.id = m.user_id
     where m.forening_id = p_forening and m.role = 'ungdom'
       and exists (select 1 from grans g where g.start is not null)
    union all
    select coalesce(nullif(c.display_name, ''), 'Barn'),
           (select coalesce(sum(x.delta), 0)::int from public.xp_ledger x, grans g
             where x.forening_id = p_forening and x.child_id = c.id
               and x.created_at >= g.start and x.created_at < g.slut),
           coalesce(c.avatar_color, '#6c4cf1')
      from public.child c
     where c.forening_id = p_forening
       and exists (select 1 from grans g where g.start is not null)
  ), ranked as (
    select e.*, row_number() over (order by e.xp desc, e.name asc) as rnk from entries e
  )
  select r.rnk::int, r.name, r.xp, r.avatar_color
    from ranked r
   where private.can_access_forening(p_forening) and r.xp > 0
   order by r.rnk
   limit 3;
$$;
grant execute on function public.leaderboard_forra(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Märken ger XP
-- Upplåsningar är beräknade (0015) och saknar därför händelse att haka på.
-- badge_unlock är kvittot: första gången en medlem synkas bokförs allt som
-- redan är upplåst OCH ger XP — de märkena är faktiskt intjänade.
-- ---------------------------------------------------------------------
alter table public.badge add column if not exists xp integer not null default 0;

update public.badge set xp = case code
  when 'first' then 50    when 'mission1' then 50    when 'shop1' then 50
  when 'visits5' then 100 when 'visits15' then 200   when 'visits40' then 400
  when 'streak3' then 150 when 'streak7' then 300    when 'streak14' then 600
  when 'level5' then 200  when 'level10' then 500
  when 'earned1000' then 150 when 'earned5000' then 400
  when 'themes4' then 250 when 'themes6' then 500    when 'activities8' then 300
  when 'weekend3' then 150 when 'photo3' then 150
  when 'missions5' then 250 when 'shop5' then 250    when 'night' then 100
  else 75                                            -- theme_* : 75
end;

create table if not exists public.badge_unlock (
  id          uuid primary key default gen_random_uuid(),
  forening_id uuid not null references public.forening(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  badge_code  text not null,
  xp          integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (forening_id, user_id, badge_code)
);
alter table public.badge_unlock enable row level security;
drop policy if exists badge_unlock_select on public.badge_unlock;
create policy badge_unlock_select on public.badge_unlock for select to authenticated
  using (user_id = auth.uid() or private.has_forening_role(forening_id, 'ledare'));
grant select on public.badge_unlock to authenticated;

create or replace function public.sync_badge_xp(p_forening uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; total int := 0;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not exists (select 1 from public.membership m
                  where m.user_id = auth.uid() and m.forening_id = p_forening) then
    return 0;
  end if;

  for r in
    select b.code, coalesce(bd.xp, 0) as xp
      from public.youth_badges(p_forening) b
      join public.badge bd on bd.code = b.code
     where b.unlocked
  loop
    insert into public.badge_unlock (forening_id, user_id, badge_code, xp)
    values (p_forening, auth.uid(), r.code, r.xp)
    on conflict (forening_id, user_id, badge_code) do nothing;

    if found and r.xp > 0 then
      perform private.apply_xp(p_forening, auth.uid(), null, r.xp);
      perform private.log_xp(p_forening, auth.uid(), null, r.xp, 'badge:' || r.code);
      total := total + r.xp;
    end if;
  end loop;

  return total;
end $$;
grant execute on function public.sync_badge_xp(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 9. Svit-märkena räknas i veckor, och youth_badges läser veckosviten
-- ---------------------------------------------------------------------
update public.badge set name = 'Uppvärmd',  description = 'Var här 3 veckor i rad',  threshold = 3  where code = 'streak3';
update public.badge set name = 'Eldsjäl',   description = 'Var här 8 veckor i rad',  threshold = 8  where code = 'streak7';
update public.badge set name = 'Ostoppbar', description = 'Var här 16 veckor i rad', threshold = 16 where code = 'streak14';

-- (Identisk med 0015 så när som på 'streak' → week_streak.)
drop function if exists public.youth_badges(uuid);
create or replace function public.youth_badges(p_forening uuid)
returns table (
  code text, name text, description text, icon text, tint text, color text,
  category text, secret boolean, unlocked boolean, progress int, goal int, sort int
)
language sql security definer set search_path = '' stable as $$
  with mine as (
    select ck.activity_id, ck.photo_url, ck.created_at at time zone 'Europe/Stockholm' as local_at, a.theme
      from public.checkin ck
      left join public.activity a on a.id = ck.activity_id
     where ck.user_id = auth.uid() and ck.forening_id = p_forening and ck.child_id is null
  ),
  agg as (
    select
      coalesce((select ms.visits from public.membership ms
                 where ms.user_id = auth.uid() and ms.forening_id = p_forening), 0) as visits,
      coalesce((select ms.week_streak from public.membership ms
                 where ms.user_id = auth.uid() and ms.forening_id = p_forening), 0) as streak,
      coalesce((select ms.level from public.membership ms
                 where ms.user_id = auth.uid() and ms.forening_id = p_forening), 1) as level,
      -- Livstidsintjänade poäng, inte saldot: att handla i butiken ska inte
      -- ta tillbaka ett märke man redan låst upp.
      coalesce((select sum(pl.delta)::int from public.points_ledger pl
                 where pl.user_id = auth.uid() and pl.forening_id = p_forening and pl.delta > 0), 0) as earned,
      (select count(distinct m.theme)::int       from mine m where m.theme is not null)       as themes,
      (select count(distinct m.activity_id)::int from mine m where m.activity_id is not null) as activities,
      (select count(*)::int from mine m where m.photo_url is not null)                        as photos,
      (select count(*)::int from mine m where extract(hour   from m.local_at) >= 20)          as night,
      (select count(*)::int from mine m where extract(isodow from m.local_at) >= 6)           as weekend,
      (select count(*)::int from public.mission_progress mp
        where mp.user_id = auth.uid() and mp.forening_id = p_forening and mp.done)            as missions,
      (select count(*)::int from public.redemption r
        where r.user_id = auth.uid() and r.forening_id = p_forening and r.child_id is null)   as redemptions
  )
  select b.code, b.name, b.description, b.icon, b.tint, b.color, b.category, b.secret,
         p.value >= g.target           as unlocked,
         least(p.value, g.target)::int as progress,
         g.target                      as goal,
         b.sort
    from public.badge b
    cross join agg
    cross join lateral (select greatest(coalesce(b.threshold, 1), 1) as target) g
    cross join lateral (select case b.criterion
        when 'visits'      then agg.visits
        when 'streak'      then agg.streak
        when 'level'       then agg.level
        when 'earned'      then agg.earned
        when 'themes'      then agg.themes
        when 'activities'  then agg.activities
        when 'photos'      then agg.photos
        when 'night'       then agg.night
        when 'weekend'     then agg.weekend
        when 'missions'    then agg.missions
        when 'redemptions' then agg.redemptions
        when 'theme'       then (select count(*)::int from mine m where m.theme = b.theme)
        else 0
      end as value) p
   order by b.sort;
$$;
grant execute on function public.youth_badges(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 10. my_children — ta med veckosviten
-- ---------------------------------------------------------------------
drop function if exists public.my_children(uuid);
create or replace function public.my_children(p_forening uuid)
returns table (id uuid, display_name text, avatar_color text, birth_year int, personnummer text,
               points int, xp int, level int, streak int, week_streak int, visits int)
language sql security definer set search_path = '' stable as $$
  select c.id, c.display_name, c.avatar_color, c.birth_year, c.personnummer,
         c.points, c.xp, c.level, c.streak, c.week_streak, c.visits
    from public.child c
   where c.parent_user_id = auth.uid() and c.forening_id = p_forening
   order by c.display_name;
$$;
grant execute on function public.my_children(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 11. "Din vecka" — allt hemskärmens veckokort behöver, i ett anrop
-- ---------------------------------------------------------------------
create or replace function public.min_vecka(p_forening uuid, p_child uuid default null)
returns jsonb language sql security definer set search_path = '' stable as $$
  with v as (select date_trunc('week', now()) as start),
  mitt as (
    select
      (select coalesce(sum(x.delta), 0)::int from public.xp_ledger x, v
        where x.forening_id = p_forening and x.created_at >= v.start
          and case when p_child is null then x.user_id = auth.uid() and x.child_id is null
                   else x.child_id = p_child end) as xp_vecka,
      (select count(*)::int from public.checkin c, v
        where c.forening_id = p_forening and coalesce(c.pending, false) = false
          and c.created_at >= v.start
          and case when p_child is null then c.user_id = auth.uid() and c.child_id is null
                   else c.child_id = p_child end) as besok_vecka,
      (select coalesce(sum(x.delta), 0)::int from public.xp_ledger x
        where x.forening_id = p_forening and x.created_at >= private.sasong_start(p_forening)
          and case when p_child is null then x.user_id = auth.uid() and x.child_id is null
                   else x.child_id = p_child end) as sasong_xp,
      case when p_child is null
           then (select ms.week_streak from public.membership ms
                  where ms.user_id = auth.uid() and ms.forening_id = p_forening)
           else (select ch.week_streak from public.child ch where ch.id = p_child)
      end as veckosvit
  )
  select jsonb_build_object(
           'xp_vecka',    mitt.xp_vecka,
           'besok_vecka', mitt.besok_vecka,
           'veckomal',    (select f.week_goal from public.forening f where f.id = p_forening),
           'veckomal_xp', (select f.week_goal_xp from public.forening f where f.id = p_forening),
           'veckosvit',   coalesce(mitt.veckosvit, 0),
           'sasong_xp',   mitt.sasong_xp,
           'klart',       exists (select 1 from public.week_goal_claim w, v
                                   where w.forening_id = p_forening
                                     and w.week_start = v.start::date
                                     and case when p_child is null then w.user_id = auth.uid()
                                              else w.child_id = p_child end)
         )
    from mitt
   where private.can_access_forening(p_forening)
     and (p_child is null
          or exists (select 1 from public.child c where c.id = p_child and c.parent_user_id = auth.uid()));
$$;
grant execute on function public.min_vecka(uuid, uuid) to authenticated;

-- Ledaren ställer veckomålet.
create or replace function public.set_forening_week_goal(
  p_forening uuid, p_goal int, p_xp int default null, p_points int default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not private.has_forening_role(p_forening, 'ledare') then
    raise exception 'Endast ledare kan ändra veckomålet';
  end if;
  update public.forening set
    week_goal        = greatest(coalesce(p_goal, week_goal), 0),
    week_goal_xp     = greatest(coalesce(p_xp, week_goal_xp), 0),
    week_goal_points = greatest(coalesce(p_points, week_goal_points), 0)
   where id = p_forening;
end $$;
grant execute on function public.set_forening_week_goal(uuid, int, int, int) to authenticated;

-- ---------------------------------------------------------------------
-- 12. Backfill — huvudboken börjar inte tom
-- Utan den skulle första säsongens topplista visa noll för alla, och all
-- historik se ut att aldrig ha hänt. Körs bara när huvudboken är tom, så
-- migrationen går att köra om.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.xp_ledger) then return; end if;

  insert into public.xp_ledger (forening_id, user_id, child_id, delta, reason, created_at)
  select c.forening_id, c.user_id, c.child_id, c.awarded_xp,
         'checkin:' || coalesce(c.activity_id::text, 'narvaro'), c.created_at
    from public.checkin c
   where coalesce(c.awarded_xp, 0) <> 0 and coalesce(c.pending, false) = false;

  -- Uppdrag och uppgifter gav förut lika mycket poäng som XP, så beloppet
  -- går att läsa ur poänghuvudboken.
  insert into public.xp_ledger (forening_id, user_id, child_id, delta, reason, created_at)
  select pl.forening_id, pl.user_id, null, pl.delta, pl.reason, pl.created_at
    from public.points_ledger pl
   where pl.delta > 0 and (pl.reason like 'mission:%' or pl.reason like 'task:%');

  insert into public.xp_ledger (forening_id, user_id, child_id, delta, reason, created_at)
  select s.forening_id, coalesce(s.student_user_id, s.larare_user_id), s.child_id, s.xp,
         'stjarna:' || s.id::text, s.granted_at
    from public.stjarna s
   where s.granted_at is not null and s.voided_at is null and s.xp <> 0
     and coalesce(s.student_user_id, s.larare_user_id) is not null;
end $$;

-- Veckosviten räknas fram för alla som redan har historik.
update public.membership m
   set week_streak = private.veckosvit(m.forening_id, m.user_id, null)
 where exists (select 1 from public.checkin c
                where c.user_id = m.user_id and c.forening_id = m.forening_id and c.child_id is null);

update public.child ch
   set week_streak = private.veckosvit(ch.forening_id, null, ch.id)
 where exists (select 1 from public.checkin c where c.child_id = ch.id);

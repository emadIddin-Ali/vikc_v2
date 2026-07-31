-- =====================================================================
-- LEVLA — 0030 marknaden: butiken har öppettider, barn får handla
--
-- Butiken var alltid öppen och varje belöning gick att ta EN gång per
-- medlem, någonsin. Verkligheten ser annorlunda ut: föreningen håller en
-- MARKNAD ungefär varannan månad då hela katalogen öppnar, och däremellan
-- dyker det upp småsaker (en pizzabit) som ska gå att köpa när som helst —
-- och köpa igen nästa gång.
--
-- Tre ändringar:
--
--   1. MARKNAD — en period då belöningar märkta 'marknad' går att lösa in.
--      Har föreningen ingen marknad alls är butiken alltid öppen, precis som
--      förut. Funktionen slås alltså på genom att lägga upp den första
--      marknaden, inte genom en inställning.
--
--   2. reward.availability + limit_per_member — 'marknad' (default) eller
--      'alltid' (pizzabiten), och hur många gånger samma medlem får ta den.
--      null = obegränsat, samma konvention som stock.
--
--   3. BARN FÅR HANDLA — ett föräldrahanterat barn samlade poäng det aldrig
--      kunde använda: redemption saknade child_id och redeem_reward slog upp
--      ett medlemskap. Koranelever är ofta just barn utan eget konto, så
--      poängen var återvändsgränd för dem.
--
-- Dessutom: stjärnor ger nu butikspoäng som standard (star_points_factor
-- 0 → 0.5). En elev som får 3★ två gånger i veckan tjänar ~880 poäng på en
-- tvåmånaderscykel, vilket är en rimlig budget till en marknad.
--
-- Kräver 0028. Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Marknaden
-- ---------------------------------------------------------------------
create table if not exists public.marknad (
  id          uuid primary key default gen_random_uuid(),
  forening_id uuid not null references public.forening(id) on delete cascade,
  name        text not null default 'Marknad',
  opens_at    timestamptz not null,
  closes_at   timestamptz not null,
  created_at  timestamptz not null default now(),
  constraint marknad_period_check check (closes_at > opens_at)
);
create index if not exists idx_marknad_forening on public.marknad(forening_id, opens_at desc);

alter table public.marknad enable row level security;
drop policy if exists marknad_select on public.marknad;
create policy marknad_select on public.marknad for select to authenticated
  using (private.can_access_forening(forening_id));
grant select on public.marknad to authenticated;

-- Är butiken öppen för marknadsvaror just nu?
-- Ingen marknad alls = alltid öppet, så en förening som inte bryr sig om
-- marknader märker aldrig att funktionen finns.
create or replace function private.marknad_oppen(fid uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select not exists (select 1 from public.marknad m where m.forening_id = fid)
      or exists (select 1 from public.marknad m
                  where m.forening_id = fid and now() between m.opens_at and m.closes_at);
$$;
grant execute on function private.marknad_oppen(uuid) to authenticated;

-- Öppen marknad om det finns en, annars nästa kommande. Driver butikens
-- banderoll: "Öppet till söndag" eller "Öppnar 14 september".
create or replace function public.marknad_status(p_forening uuid)
returns jsonb language sql security definer set search_path = '' stable as $$
  with nu as (
    select m.* from public.marknad m
     where m.forening_id = p_forening and now() between m.opens_at and m.closes_at
     order by m.closes_at limit 1
  ), nasta as (
    select m.* from public.marknad m
     where m.forening_id = p_forening and m.opens_at > now()
     order by m.opens_at limit 1
  )
  select jsonb_build_object(
           'anvander_marknad', exists (select 1 from public.marknad m where m.forening_id = p_forening),
           'oppen',     exists (select 1 from nu),
           'namn',      coalesce((select name from nu),      (select name from nasta)),
           'opens_at',  coalesce((select opens_at from nu),  (select opens_at from nasta)),
           'closes_at', coalesce((select closes_at from nu), (select closes_at from nasta))
         )
   where private.can_access_forening(p_forening);
$$;
grant execute on function public.marknad_status(uuid) to authenticated;

-- ---------- ledarens marknadshantering ----------
create or replace function public.ledare_marknader(p_forening uuid)
returns table (id uuid, name text, opens_at timestamptz, closes_at timestamptz, oppen boolean)
language sql security definer set search_path = '' stable as $$
  select m.id, m.name, m.opens_at, m.closes_at,
         (now() between m.opens_at and m.closes_at)
    from public.marknad m
   where m.forening_id = p_forening
     and private.has_forening_role(p_forening, 'ledare')
   order by m.opens_at desc;
$$;
grant execute on function public.ledare_marknader(uuid) to authenticated;

create or replace function public.save_marknad(
  p_forening uuid, p_opens timestamptz, p_closes timestamptz,
  p_name text default 'Marknad', p_id uuid default null
) returns public.marknad language plpgsql security definer set search_path = '' as $$
declare m public.marknad;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not private.has_forening_role(p_forening, 'ledare') then
    raise exception 'Bara ledare kan lägga upp en marknad';
  end if;
  if p_closes <= p_opens then raise exception 'Marknaden måste stänga efter att den öppnat'; end if;

  if p_id is null then
    insert into public.marknad (forening_id, name, opens_at, closes_at)
    values (p_forening, coalesce(nullif(trim(p_name), ''), 'Marknad'), p_opens, p_closes)
    returning * into m;
  else
    update public.marknad
       set name = coalesce(nullif(trim(p_name), ''), name), opens_at = p_opens, closes_at = p_closes
     where id = p_id and forening_id = p_forening
    returning * into m;
    if not found then raise exception 'Marknaden finns inte'; end if;
  end if;
  return m;
end $$;
grant execute on function public.save_marknad(uuid, timestamptz, timestamptz, text, uuid) to authenticated;

create or replace function public.delete_marknad(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  select forening_id into fid from public.marknad where id = p_id;
  if fid is null then raise exception 'Marknaden finns inte'; end if;
  if not private.has_forening_role(fid, 'ledare') then raise exception 'Bara ledare kan ta bort en marknad'; end if;
  delete from public.marknad where id = p_id;
end $$;
grant execute on function public.delete_marknad(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Belöningen: när och hur ofta
-- ---------------------------------------------------------------------
alter table public.reward
  add column if not exists availability     text    not null default 'marknad',
  add column if not exists limit_per_member integer default 1;

alter table public.reward drop constraint if exists reward_availability_check;
alter table public.reward add constraint reward_availability_check
  check (availability in ('marknad', 'alltid'));
alter table public.reward drop constraint if exists reward_limit_check;
alter table public.reward add constraint reward_limit_check
  check (limit_per_member is null or limit_per_member >= 1);

comment on column public.reward.availability is
  '''marknad'' = bara när en marknad är öppen. ''alltid'' = alltid köpbar (pizzabiten).';
comment on column public.reward.limit_per_member is
  'Hur många gånger samma medlem får ta belöningen. null = obegränsat.';

-- ---------------------------------------------------------------------
-- 3. Barn får handla
-- ---------------------------------------------------------------------
alter table public.redemption add column if not exists child_id uuid references public.child(id) on delete cascade;
create index if not exists idx_redemption_child on public.redemption(child_id, created_at desc);

-- Föräldern ska se sitt barns uttag (kvittot), inte bara sina egna.
drop policy if exists redemption_select on public.redemption;
create policy redemption_select on public.redemption for select to authenticated
  using (
    user_id = auth.uid()
    or private.has_forening_role(forening_id, 'ledare')
    or exists (select 1 from public.child c where c.id = redemption.child_id and c.parent_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- Stjärnor ger butikspoäng som standard
-- Engångs-ombaslinjering: gjord innan lansering, medan alla föreningar
-- fortfarande ligger på det ursprungliga 0. Efter det ändrar varje förening
-- själv i ledarens Klasser-flik.
-- ---------------------------------------------------------------------
-- Ombaslinjeringen körs bara den gång då kolumnens default fortfarande är 0.
-- Utan den kontrollen skulle en omkörning skriva över en förening som medvetet
-- ställt tillbaka faktorn till 0.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'forening'
       and column_name = 'star_points_factor' and column_default like '0.5%'
  ) then
    update public.forening set star_points_factor = 0.5 where star_points_factor = 0;
  end if;
end $$;

alter table public.forening alter column star_points_factor set default 0.5;

-- ---------------------------------------------------------------------
-- youth_shop v3 — öppettid, upprepade köp och barn
-- ---------------------------------------------------------------------
drop function if exists public.youth_shop(uuid);
create or replace function public.youth_shop(p_forening uuid, p_child uuid default null)
returns table (
  id uuid, title text, tag text, icon text, tint text, cost int,
  stock int, taken int, mina int, limit_per_member int,
  availability text, kopbar boolean
)
language sql security definer set search_path = '' stable as $$
  select r.id, r.title, r.tag, r.icon, r.tint, r.cost, r.stock,
         (select count(*)::int from public.redemption d where d.reward_id = r.id),
         (select count(*)::int from public.redemption d
           where d.reward_id = r.id
             and case when p_child is null then d.user_id = auth.uid() and d.child_id is null
                      else d.child_id = p_child end),
         r.limit_per_member,
         r.availability,
         (r.availability = 'alltid' or private.marknad_oppen(p_forening))
    from public.reward r
   where r.forening_id = p_forening
     and r.active = true
     and case
           when p_child is not null then exists (
             select 1 from public.child c
              where c.id = p_child and c.parent_user_id = auth.uid() and c.forening_id = p_forening)
           else exists (
             select 1 from public.membership m
              where m.user_id = auth.uid() and m.forening_id = p_forening)
         end
   order by r.availability desc, r.cost;
$$;
grant execute on function public.youth_shop(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- redeem_reward v3
-- Behåller låsordningen från 0024 (belöningen först, sedan saldoraden) —
-- utan den kunde två samtidiga uttag båda passera saldokontrollen.
-- ---------------------------------------------------------------------
drop function if exists public.redeem_reward(uuid);
create or replace function public.redeem_reward(p_reward_id uuid, p_child uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r       public.reward;
  ch      public.child;
  saldo   int;
  taken   int;
  mina    int;
  oppnar  timestamptz;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;

  select * into r from public.reward where id = p_reward_id and active = true for update;
  if not found then raise exception 'Belöningen finns inte'; end if;

  -- Öppettid
  if r.availability = 'marknad' and not private.marknad_oppen(r.forening_id) then
    select min(m.opens_at) into oppnar from public.marknad m
     where m.forening_id = r.forening_id and m.opens_at > now();
    if oppnar is null then
      raise exception 'Butiken är stängd just nu';
    else
      -- to_char med månadsnamn följer serverns lokal och blir engelskt; siffror
      -- säger samma sak på svenska.
      raise exception 'Butiken öppnar på marknaden %', to_char(oppnar, 'DD/MM');
    end if;
  end if;

  -- Vem handlar, och med vilket saldo?
  if p_child is not null then
    select * into ch from public.child
     where id = p_child and parent_user_id = auth.uid() and forening_id = r.forening_id for update;
    if not found then raise exception 'Barnet tillhör inte den här föreningen'; end if;
    saldo := ch.points;
  else
    select m.points into saldo from public.membership m
     where m.user_id = auth.uid() and m.forening_id = r.forening_id for update;
    if saldo is null then raise exception 'Du är inte medlem i den här föreningen'; end if;
  end if;

  -- Hur många gånger har den här köparen redan tagit den?
  select count(*)::int into mina from public.redemption d
   where d.reward_id = r.id
     and case when p_child is null then d.user_id = auth.uid() and d.child_id is null
              else d.child_id = p_child end;
  if r.limit_per_member is not null and mina >= r.limit_per_member then
    raise exception '%', case when r.limit_per_member = 1 then 'Redan uttagen'
                             else 'Du har hämtat den här ' || r.limit_per_member || ' gånger' end;
  end if;

  if r.stock is not null then
    select count(*)::int into taken from public.redemption where reward_id = r.id;
    if taken >= r.stock then raise exception 'Slut — alla % är uttagna', r.stock; end if;
  end if;

  if saldo < r.cost then raise exception 'Inte tillräckligt med poäng'; end if;

  insert into public.redemption (forening_id, user_id, child_id, reward_id, cost)
  values (r.forening_id, auth.uid(), p_child, r.id, r.cost);

  insert into public.points_ledger (forening_id, user_id, child_id, delta, reason)
  values (r.forening_id, auth.uid(), p_child, -r.cost, 'redeem:' || r.id::text);

  return jsonb_build_object('cost', r.cost, 'title', r.title, 'points_left', saldo - r.cost);
end $$;
grant execute on function public.redeem_reward(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- ledare_rewards — ta med öppettid och gräns
-- ---------------------------------------------------------------------
drop function if exists public.ledare_rewards(uuid);
create or replace function public.ledare_rewards(p_forening uuid)
returns table (
  id uuid, title text, tag text, icon text, tint text, cost int,
  stock int, taken int, mina int, limit_per_member int,
  availability text, kopbar boolean, active boolean
)
language sql security definer set search_path = '' stable as $$
  select r.id, r.title, r.tag, r.icon, r.tint, r.cost, r.stock,
         (select count(*)::int from public.redemption d where d.reward_id = r.id),
         0,
         r.limit_per_member,
         r.availability,
         (r.availability = 'alltid' or private.marknad_oppen(p_forening)),
         r.active
    from public.reward r
   where r.forening_id = p_forening
     and private.has_forening_role(p_forening, 'ledare')
   order by r.active desc, r.availability desc, r.cost;
$$;
grant execute on function public.ledare_rewards(uuid) to authenticated;

-- Ledaren ändrar när och hur ofta en belöning går att ta.
create or replace function public.set_reward_availability(
  p_reward uuid, p_availability text, p_limit int default null
) returns void language plpgsql security definer set search_path = '' as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if p_availability not in ('marknad', 'alltid') then raise exception 'Ogiltig tillgänglighet'; end if;
  select forening_id into fid from public.reward where id = p_reward;
  if fid is null then raise exception 'Belöningen finns inte'; end if;
  if not private.has_forening_role(fid, 'ledare') then raise exception 'Endast ledare'; end if;

  update public.reward
     set availability = p_availability,
         limit_per_member = case when p_limit is null or p_limit < 1 then null else p_limit end
   where id = p_reward;
end $$;
grant execute on function public.set_reward_availability(uuid, text, int) to authenticated;

-- ---------------------------------------------------------------------
-- Barnets uttag (kvittot föräldern visar upp på marknaden)
-- ---------------------------------------------------------------------
create or replace function public.child_redemptions(p_child uuid)
returns table (id uuid, title text, cost int, created_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select d.id, coalesce(r.title, 'Belöning'), d.cost, d.created_at
    from public.redemption d
    left join public.reward r on r.id = d.reward_id
   where d.child_id = p_child
     and exists (select 1 from public.child c where c.id = p_child and c.parent_user_id = auth.uid())
   order by d.created_at desc
   limit 50;
$$;
grant execute on function public.child_redemptions(uuid) to authenticated;

-- =====================================================================
-- LEVLA — 0028 klasser, lektioner och stjärnor (lärarrollen)
--
-- En LÄRARE (t.ex. koranlärare) går med i föreningen med föreningskoden och
-- väljer rollen "Lärare". Rollen är spärrad tills en ledare godkänner den —
-- annars kunde vem som helst som fått koden ge sig själv lärarbehörighet.
--
-- Läraren skapar KLASSER och adopterar elever ur föreningen. En elev är
-- antingen en ungdomsmedlem (eget konto) eller ett barn (child, förälder-
-- hanterat utan inloggning) — samma polymorfi som checkin/points_ledger
-- redan använder.
--
-- Läraren håller LEKTIONER. En lektion är en dag i en klass: närvaro per
-- elev + en stjärnsättning (1–5) per elev med en kategori (hifz, murajaa,
-- tajwid, läxa, närvaro, adab). Under lektionen är stjärnorna UTKAST — inget
-- XP delas ut. Först när lektionen avslutas skrivs allt i en transaktion:
--   * närvaro  → en checkin-rad (håller streak, besök och Mål-uppdrag vid liv)
--   * stjärnor → XP enligt föreningens stjärnkurva, ev. poäng, notis till
--                eleven (eller till förälderns konto för barn)
--
-- STJÄRNKURVAN är icke-linjär och per förening (forening.star_xp), default
-- 25/60/110/180/300. Annars vore 5×1★ värt lika mycket som 1×5★ och betyget
-- skulle sakna innebörd.
--
-- POÄNG (butiksvalutan) delas INTE ut som standard — en generös lärare ska
-- inte kunna tömma belöningslagret. forening.star_points_factor > 0 slår på
-- det för den förening som vill.
--
-- ÅNGRA, INTE RADERA: en ångrad stjärna markeras voided och XP/poäng backas
-- ut. Historiken ska aldrig ljuga.
--
-- Kräver 0027. Idempotent — kan köras om.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Föreningsinställningar för stjärnor
-- ---------------------------------------------------------------------
alter table public.forening
  add column if not exists star_xp             integer[]    not null default '{25,60,110,180,300}',
  add column if not exists star_points_factor  numeric(4,2) not null default 0,
  add column if not exists star_max_per_vecka  integer      not null default 25;

alter table public.forening drop constraint if exists forening_star_xp_check;
alter table public.forening add constraint forening_star_xp_check
  check (array_length(star_xp, 1) = 5 and 0 <= all(star_xp));

alter table public.forening drop constraint if exists forening_star_factor_check;
alter table public.forening add constraint forening_star_factor_check
  check (star_points_factor >= 0 and star_points_factor <= 2);

comment on column public.forening.star_xp is
  'XP per stjärnnivå 1–5. Icke-linjär så att 5★ är värt mer än 5×1★.';
comment on column public.forening.star_points_factor is
  'Andel av stjärnans XP som också ges som butikspoäng. 0 = stjärnor ger bara XP.';
comment on column public.forening.star_max_per_vecka is
  'Tak för hur många stjärnor EN lärare får ge EN elev per vecka (inflationsspärr).';

-- ---------------------------------------------------------------------
-- Lärare måste godkännas av en ledare
-- Default true så att alla BEFINTLIGA medlemsrader är opåverkade; det är
-- bara join-flödet nedan som sätter false, och bara för rollen 'larare'.
-- ---------------------------------------------------------------------
alter table public.membership add column if not exists larare_godkand boolean not null default true;

-- ---------------------------------------------------------------------
-- Tabeller
-- ---------------------------------------------------------------------

-- En klass (halaqa/grupp) inom en förening, ledd av en lärare.
-- larare_user_id är NULLABLE med on delete set null: om läraren raderar sitt
-- konto ska klassen och elevernas stjärnhistorik överleva så att ledaren kan
-- tilldela en ny lärare.
create table if not exists public.klass (
  id             uuid primary key default gen_random_uuid(),
  forening_id    uuid not null references public.forening(id) on delete cascade,
  larare_user_id uuid references auth.users(id) on delete set null,
  name           text not null,
  description    text,                                   -- nivå, juz, årskurs …
  weekday        smallint check (weekday between 0 and 6), -- 0 = söndag
  time_text      text,                                   -- "10:00–11:30"
  color          text not null default '#6c4cf1',
  join_code      text unique,                            -- klasskod (elev/förälder kan gå med själv)
  archived       boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists idx_klass_forening on public.klass(forening_id);
create index if not exists idx_klass_larare   on public.klass(larare_user_id);

-- En elev i en klass. Exakt ett av student_user_id / child_id är satt.
create table if not exists public.klass_elev (
  id              uuid primary key default gen_random_uuid(),
  klass_id        uuid not null references public.klass(id) on delete cascade,
  forening_id     uuid not null references public.forening(id) on delete cascade,
  student_user_id uuid references auth.users(id) on delete cascade,
  child_id        uuid references public.child(id) on delete cascade,
  added_by        uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint klass_elev_one_target check (num_nonnulls(student_user_id, child_id) = 1)
);
create unique index if not exists uq_klass_elev_user
  on public.klass_elev(klass_id, student_user_id) where student_user_id is not null;
create unique index if not exists uq_klass_elev_child
  on public.klass_elev(klass_id, child_id) where child_id is not null;
create index if not exists idx_klass_elev_klass   on public.klass_elev(klass_id);
create index if not exists idx_klass_elev_student on public.klass_elev(student_user_id);
create index if not exists idx_klass_elev_child   on public.klass_elev(child_id);

-- En lektion = en dag i en klass. Max en per klass och dag.
create table if not exists public.lektion (
  id             uuid primary key default gen_random_uuid(),
  klass_id       uuid not null references public.klass(id) on delete cascade,
  forening_id    uuid not null references public.forening(id) on delete cascade,
  larare_user_id uuid references auth.users(id) on delete set null,
  held_on        date not null default current_date,
  note           text,
  closed_at      timestamptz,
  created_at     timestamptz not null default now(),
  unique (klass_id, held_on)
);
create index if not exists idx_lektion_klass on public.lektion(klass_id, held_on desc);

create table if not exists public.lektion_narvaro (
  id            uuid primary key default gen_random_uuid(),
  lektion_id    uuid not null references public.lektion(id) on delete cascade,
  klass_elev_id uuid not null references public.klass_elev(id) on delete cascade,
  status        text not null default 'har' check (status in ('har','sen','borta','anmald')),
  created_at    timestamptz not null default now(),
  unique (lektion_id, klass_elev_id)
);

-- Stjärnhuvudboken. En rad = en bedömning.
-- Rader med lektion_id och granted_at = null är UTKAST (lektionen pågår).
create table if not exists public.stjarna (
  id              uuid primary key default gen_random_uuid(),
  forening_id     uuid not null references public.forening(id) on delete cascade,
  klass_id        uuid references public.klass(id) on delete set null,
  lektion_id      uuid references public.lektion(id) on delete cascade,
  larare_user_id  uuid references auth.users(id) on delete set null,
  student_user_id uuid references auth.users(id) on delete cascade,
  child_id        uuid references public.child(id) on delete cascade,
  stars           smallint not null check (stars between 1 and 5),
  kategori        text not null default 'hifz'
                    check (kategori in ('hifz','murajaa','tajwid','laxa','narvaro','adab')),
  note            text,
  xp              integer not null default 0,   -- faktiskt utdelat vid granted_at
  points          integer not null default 0,
  -- Hifz-spåret (0029) fyller de här: vad som reciterades. Lämnas null tills dess.
  sura            smallint,
  ayah_from       smallint,
  ayah_to         smallint,
  granted_at      timestamptz,
  voided_at       timestamptz,
  voided_by       uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint stjarna_one_target check (num_nonnulls(student_user_id, child_id) = 1)
);
-- En stjärnsättning per elev och lektion (den som gäller).
create unique index if not exists uq_stjarna_lektion_elev
  on public.stjarna(lektion_id, coalesce(student_user_id, child_id))
  where lektion_id is not null and voided_at is null;
create index if not exists idx_stjarna_student  on public.stjarna(student_user_id, created_at desc);
create index if not exists idx_stjarna_child    on public.stjarna(child_id, created_at desc);
create index if not exists idx_stjarna_forening on public.stjarna(forening_id, created_at desc);
create index if not exists idx_stjarna_klass    on public.stjarna(klass_id, created_at desc);

-- ---------------------------------------------------------------------
-- SECURITY DEFINER-hjälpare (kör som ägaren → ingen rekursiv RLS-utvärdering)
-- ---------------------------------------------------------------------

-- Godkänd lärare i föreningen?
create or replace function private.is_larare(fid uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.membership m
     where m.user_id = auth.uid() and m.forening_id = fid
       and m.role = 'larare' and m.larare_godkand
  );
$$;

-- Får jag styra den här klassen? (dess lärare, eller en ledare i föreningen)
create or replace function private.kan_styra_klass(kid uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.klass k
     where k.id = kid
       and (k.larare_user_id = auth.uid() or private.has_forening_role(k.forening_id, 'ledare'))
  );
$$;

-- Får jag se den här elevens stjärnor? Eleven själv, barnets förälder,
-- en lärare som har eleven i en klass, eller en ledare i föreningen.
create or replace function private.kan_se_elev(p_user uuid, p_child uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select case
    when p_child is not null then exists (
      select 1 from public.child c
       where c.id = p_child
         and (c.parent_user_id = auth.uid()
              or private.has_forening_role(c.forening_id, 'ledare')
              or exists (select 1 from public.klass_elev e
                           join public.klass k on k.id = e.klass_id
                          where e.child_id = p_child and k.larare_user_id = auth.uid()))
    )
    else p_user = auth.uid() or exists (
      select 1 from public.klass_elev e
        join public.klass k on k.id = e.klass_id
       where e.student_user_id = p_user
         and (k.larare_user_id = auth.uid() or private.has_forening_role(k.forening_id, 'ledare'))
    )
  end;
$$;

-- XP för en stjärnnivå enligt föreningens kurva.
create or replace function private.star_xp(fid uuid, p_stars int)
returns integer language sql security definer set search_path = '' stable as $$
  select coalesce(
    (select f.star_xp[greatest(least(p_stars, 5), 1)] from public.forening f where f.id = fid),
    0);
$$;

-- Lägg till (eller dra av) XP för en medlem eller ett barn.
-- Nivåmodellen lagrar RESTEN inom nivån, så vi räknar om via total-XP —
-- det gör funktionen symmetrisk och därmed möjlig att backa ut.
create or replace function private.apply_xp(p_forening uuid, p_user uuid, p_child uuid, p_delta int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  xp_max constant int := 1000;
  cur_xp int; cur_level int; total int; new_level int; new_xp int;
begin
  if p_child is not null then
    select xp, level into cur_xp, cur_level from public.child where id = p_child for update;
  else
    select xp, level into cur_xp, cur_level from public.membership
     where user_id = p_user and forening_id = p_forening for update;
  end if;
  if cur_xp is null then raise exception 'Eleven finns inte i föreningen'; end if;

  total     := greatest((cur_level - 1) * xp_max + cur_xp + p_delta, 0);
  new_level := (total / xp_max) + 1;
  new_xp    := total % xp_max;

  if p_child is not null then
    update public.child set xp = new_xp, level = new_level where id = p_child;
  else
    update public.membership set xp = new_xp, level = new_level
     where user_id = p_user and forening_id = p_forening;
  end if;

  return jsonb_build_object('level', new_level, 'xp', new_xp, 'leveled_up', new_level > cur_level);
end $$;

-- Uppdatera streak + besök. MÅSTE anropas FÖRE checkin-raden skrivs, annars
-- ser den dagens egen rad som "senaste besök" och streaken står stilla.
create or replace function private.bump_streak(p_forening uuid, p_user uuid, p_child uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare last_visit date; cur int; nxt int;
begin
  if p_child is not null then
    select max(c.created_at::date) into last_visit from public.checkin c
     where c.child_id = p_child and c.forening_id = p_forening;
    select streak into cur from public.child where id = p_child;
  else
    select max(c.created_at::date) into last_visit from public.checkin c
     where c.user_id = p_user and c.forening_id = p_forening and c.child_id is null;
    select streak into cur from public.membership
     where user_id = p_user and forening_id = p_forening;
  end if;

  cur := coalesce(cur, 0);
  if    last_visit is null              then nxt := 1;
  elsif last_visit = current_date       then nxt := greatest(cur, 1);
  elsif last_visit = current_date - 1   then nxt := cur + 1;
  else                                       nxt := 1;
  end if;

  if p_child is not null then
    update public.child set streak = nxt, visits = visits + 1 where id = p_child;
  else
    update public.membership set streak = nxt, visits = visits + 1
     where user_id = p_user and forening_id = p_forening;
  end if;
end $$;

grant execute on function private.is_larare(uuid)                              to authenticated;
grant execute on function private.kan_styra_klass(uuid)                        to authenticated;
grant execute on function private.kan_se_elev(uuid, uuid)                      to authenticated;
grant execute on function private.star_xp(uuid, int)                           to authenticated;
grant execute on function private.apply_xp(uuid, uuid, uuid, int)              to authenticated;
grant execute on function private.bump_streak(uuid, uuid, uuid)                to authenticated;

-- ---------------------------------------------------------------------
-- RLS. All SKRIVNING sker via SECURITY DEFINER-RPC:er nedan — inga
-- write-policyer. Select-policyerna refererar aldrig tillbaka till en
-- tabell vars egen policy läser den här (annars rekursion); studenternas
-- läsvägar går via private-hjälparna som kör som ägaren.
-- ---------------------------------------------------------------------
alter table public.klass           enable row level security;
alter table public.klass_elev      enable row level security;
alter table public.lektion         enable row level security;
alter table public.lektion_narvaro enable row level security;
alter table public.stjarna         enable row level security;

drop policy if exists klass_select on public.klass;
create policy klass_select on public.klass for select to authenticated
  using (larare_user_id = auth.uid() or private.has_forening_role(forening_id, 'ledare'));

drop policy if exists klass_elev_select on public.klass_elev;
create policy klass_elev_select on public.klass_elev for select to authenticated
  using (
    student_user_id = auth.uid()
    or private.kan_styra_klass(klass_id)
    or exists (select 1 from public.child c where c.id = klass_elev.child_id and c.parent_user_id = auth.uid())
  );

drop policy if exists lektion_select on public.lektion;
create policy lektion_select on public.lektion for select to authenticated
  using (private.kan_styra_klass(klass_id));

drop policy if exists lektion_narvaro_select on public.lektion_narvaro;
create policy lektion_narvaro_select on public.lektion_narvaro for select to authenticated
  using (exists (select 1 from public.lektion l
                  where l.id = lektion_narvaro.lektion_id and private.kan_styra_klass(l.klass_id)));

drop policy if exists stjarna_select on public.stjarna;
create policy stjarna_select on public.stjarna for select to authenticated
  using (
    student_user_id = auth.uid()
    or larare_user_id = auth.uid()
    or private.has_forening_role(forening_id, 'ledare')
    or exists (select 1 from public.child c where c.id = stjarna.child_id and c.parent_user_id = auth.uid())
  );

grant select on public.klass, public.klass_elev, public.lektion,
                public.lektion_narvaro, public.stjarna to authenticated;

-- ---------------------------------------------------------------------
-- Gå med som ungdom, förälder ELLER lärare
-- Lärarrollen skapas spärrad (larare_godkand = false) och kravet på
-- personnummer gäller inte lärare — registret handlar om deltagarna.
-- ---------------------------------------------------------------------
create or replace function public.join_forening_by_code(
  p_code text, p_role text default 'ungdom', p_personnummer text default null
)
returns public.membership language plpgsql security definer set search_path = '' as $$
declare
  f public.forening;
  m public.membership;
  pnr text := nullif(private.pnr_digits(p_personnummer), '');
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if p_role not in ('ungdom', 'foralder', 'larare') then raise exception 'Ogiltig roll'; end if;

  select * into f from public.forening where join_code = upper(trim(p_code));
  if not found then raise exception 'Ogiltig föreningskod'; end if;

  if p_role <> 'larare' then
    if f.require_personnummer and pnr is null then
      raise exception 'Föreningen kräver personnummer';
    end if;
    if pnr is not null and not private.valid_pnr(pnr) then
      raise exception 'Ogiltigt personnummer';
    end if;
  else
    pnr := null;
  end if;

  insert into public.membership (user_id, forening_id, role, personnummer, larare_godkand)
  values (auth.uid(), f.id, p_role::public.app_role, pnr, p_role <> 'larare')
  on conflict (user_id, forening_id)
    do update set personnummer = coalesce(excluded.personnummer, public.membership.personnummer)
  returning * into m;

  -- Notera ledarna om att en lärare väntar på godkännande.
  if m.role = 'larare' and not m.larare_godkand then
    insert into public.notification (forening_id, user_id, icon, tint, title, body)
    select f.id, l.user_id, 'shield', '#fff3e0', 'En lärare väntar på godkännande',
           coalesce(nullif(p.display_name, ''), 'En användare') || ' vill bli lärare i ' || f.name || '.'
      from public.membership l
      join public.profiles p on p.id = auth.uid()
     where l.forening_id = f.id and l.role = 'ledare';
  end if;

  return m;
end $$;
grant execute on function public.join_forening_by_code(text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- LEDARE: godkänna lärare och styra stjärnekonomin
-- ---------------------------------------------------------------------

create or replace function public.ledare_larare(p_forening uuid)
returns table (user_id uuid, name text, avatar_color text, godkand boolean,
               klasser int, elever int, stjarnor_30d int, snitt numeric)
language sql security definer set search_path = '' stable as $$
  select m.user_id,
         coalesce(nullif(p.display_name, ''), 'Lärare'),
         coalesce(p.avatar_color, '#6c4cf1'),
         m.larare_godkand,
         (select count(*) from public.klass k
           where k.larare_user_id = m.user_id and k.forening_id = p_forening and not k.archived)::int,
         (select count(*) from public.klass_elev e
            join public.klass k on k.id = e.klass_id
           where k.larare_user_id = m.user_id and k.forening_id = p_forening and not k.archived)::int,
         (select coalesce(sum(s.stars), 0) from public.stjarna s
           where s.larare_user_id = m.user_id and s.forening_id = p_forening
             and s.voided_at is null and s.created_at > now() - interval '30 days')::int,
         (select round(avg(s.stars), 1) from public.stjarna s
           where s.larare_user_id = m.user_id and s.forening_id = p_forening
             and s.voided_at is null and s.created_at > now() - interval '30 days')
    from public.membership m
    join public.profiles p on p.id = m.user_id
   where m.forening_id = p_forening and m.role = 'larare'
     and private.has_forening_role(p_forening, 'ledare')
   order by m.larare_godkand, 2;
$$;
grant execute on function public.ledare_larare(uuid) to authenticated;

create or replace function public.godkann_larare(p_forening uuid, p_user uuid, p_godkann boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare f public.forening;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not private.has_forening_role(p_forening, 'ledare') then
    raise exception 'Bara ledare kan godkänna lärare';
  end if;

  update public.membership set larare_godkand = coalesce(p_godkann, false)
   where user_id = p_user and forening_id = p_forening and role = 'larare';
  if not found then raise exception 'Hittar ingen lärare att godkänna'; end if;

  select * into f from public.forening where id = p_forening;
  insert into public.notification (forening_id, user_id, icon, tint, title, body)
  values (p_forening, p_user,
          case when p_godkann then 'check' else 'shield' end,
          case when p_godkann then '#dcfce7' else '#fee2e2' end,
          case when p_godkann then 'Du är godkänd som lärare' else 'Din lärarbehörighet är pausad' end,
          case when p_godkann then 'Du kan nu skapa klasser i ' || f.name || '.'
               else 'Kontakta en ledare i ' || f.name || '.' end);
end $$;
grant execute on function public.godkann_larare(uuid, uuid, boolean) to authenticated;

create or replace function public.set_forening_star_settings(
  p_forening uuid, p_star_xp int[], p_points_factor numeric default null, p_max_vecka int default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not private.has_forening_role(p_forening, 'ledare') then
    raise exception 'Bara ledare kan ändra stjärnvärdena';
  end if;
  if p_star_xp is not null and array_length(p_star_xp, 1) <> 5 then
    raise exception 'Stjärnkurvan måste ha fem värden';
  end if;

  update public.forening set
    star_xp            = coalesce(p_star_xp, star_xp),
    star_points_factor = coalesce(p_points_factor, star_points_factor),
    star_max_per_vecka = coalesce(p_max_vecka, star_max_per_vecka)
   where id = p_forening;
end $$;
grant execute on function public.set_forening_star_settings(uuid, int[], numeric, int) to authenticated;

-- Ledarens klassöversikt (alla klasser, oavsett lärare).
create or replace function public.ledare_klasser(p_forening uuid)
returns table (id uuid, name text, larare text, weekday smallint, time_text text, color text,
               elever int, stjarnor_30d int, senaste_lektion date)
language sql security definer set search_path = '' stable as $$
  select k.id, k.name,
         coalesce(nullif(p.display_name, ''), 'Ingen lärare'),
         k.weekday, k.time_text, k.color,
         (select count(*) from public.klass_elev e where e.klass_id = k.id)::int,
         (select coalesce(sum(s.stars), 0) from public.stjarna s
           where s.klass_id = k.id and s.voided_at is null
             and s.created_at > now() - interval '30 days')::int,
         (select max(l.held_on) from public.lektion l where l.klass_id = k.id)
    from public.klass k
    left join public.profiles p on p.id = k.larare_user_id
   where k.forening_id = p_forening and not k.archived
     and private.has_forening_role(p_forening, 'ledare')
   order by k.weekday nulls last, k.name;
$$;
grant execute on function public.ledare_klasser(uuid) to authenticated;

-- Flytta en klass till en annan lärare (t.ex. när en lärare slutar).
create or replace function public.tilldela_klass(p_klass uuid, p_larare uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare k public.klass;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  select * into k from public.klass where id = p_klass;
  if not found then raise exception 'Klassen finns inte'; end if;
  if not private.has_forening_role(k.forening_id, 'ledare') then
    raise exception 'Bara ledare kan byta lärare på en klass';
  end if;
  if not exists (select 1 from public.membership m
                  where m.user_id = p_larare and m.forening_id = k.forening_id
                    and m.role = 'larare' and m.larare_godkand) then
    raise exception 'Personen är inte godkänd lärare i föreningen';
  end if;

  update public.klass set larare_user_id = p_larare where id = p_klass;
end $$;
grant execute on function public.tilldela_klass(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- LÄRARE: klasser
-- ---------------------------------------------------------------------

create or replace function public.larare_klasser(p_forening uuid)
returns table (id uuid, name text, description text, weekday smallint, time_text text,
               color text, join_code text, elever int, stjarnor_veckan int,
               senaste_lektion date, oppen_lektion uuid)
language sql security definer set search_path = '' stable as $$
  select k.id, k.name, k.description, k.weekday, k.time_text, k.color, k.join_code,
         (select count(*) from public.klass_elev e where e.klass_id = k.id)::int,
         (select coalesce(sum(s.stars), 0) from public.stjarna s
           where s.klass_id = k.id and s.voided_at is null
             and s.created_at >= date_trunc('week', now()))::int,
         (select max(l.held_on) from public.lektion l where l.klass_id = k.id),
         (select l.id from public.lektion l
           where l.klass_id = k.id and l.closed_at is null
           order by l.held_on desc limit 1)
    from public.klass k
   where k.forening_id = p_forening and not k.archived
     and k.larare_user_id = auth.uid()
   order by k.weekday nulls last, k.name;
$$;
grant execute on function public.larare_klasser(uuid) to authenticated;

create or replace function public.create_klass(
  p_forening uuid, p_name text, p_description text default null,
  p_weekday int default null, p_time_text text default null, p_color text default '#6c4cf1'
) returns public.klass language plpgsql security definer set search_path = '' as $$
declare k public.klass; code text;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not private.is_larare(p_forening) then
    raise exception 'Bara godkända lärare kan skapa klasser';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Skriv ett namn på klassen'; end if;

  loop
    code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.klass c where c.join_code = code);
  end loop;

  insert into public.klass (forening_id, larare_user_id, name, description, weekday, time_text, color, join_code)
  values (p_forening, auth.uid(), trim(p_name), nullif(trim(coalesce(p_description, '')), ''),
          p_weekday, nullif(trim(coalesce(p_time_text, '')), ''),
          coalesce(nullif(trim(coalesce(p_color, '')), ''), '#6c4cf1'), code)
  returning * into k;
  return k;
end $$;
grant execute on function public.create_klass(uuid, text, text, int, text, text) to authenticated;

create or replace function public.update_klass(
  p_klass uuid, p_name text default null, p_description text default null,
  p_weekday int default null, p_time_text text default null, p_color text default null
) returns public.klass language plpgsql security definer set search_path = '' as $$
declare k public.klass;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not private.kan_styra_klass(p_klass) then raise exception 'Det här är inte din klass'; end if;

  update public.klass set
    name        = coalesce(nullif(trim(coalesce(p_name, '')), ''), name),
    description = nullif(trim(coalesce(p_description, '')), ''),
    weekday     = p_weekday,
    time_text   = nullif(trim(coalesce(p_time_text, '')), ''),
    color       = coalesce(nullif(trim(coalesce(p_color, '')), ''), color)
   where id = p_klass
  returning * into k;
  return k;
end $$;
grant execute on function public.update_klass(uuid, text, text, int, text, text) to authenticated;

create or replace function public.archive_klass(p_klass uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not private.kan_styra_klass(p_klass) then raise exception 'Det här är inte din klass'; end if;
  update public.klass set archived = true where id = p_klass;
end $$;
grant execute on function public.archive_klass(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- LÄRARE: adoptera elever ur föreningen
--
-- Listan är avsiktligt avskalad — namn, avatar och födelseår. Ingen
-- kontaktinfo och ALDRIG personnummer: det tillhör ledarens register.
-- ---------------------------------------------------------------------
create or replace function public.forening_elever(p_forening uuid, p_query text default null)
returns table (kind text, user_id uuid, child_id uuid, name text, avatar_color text,
               birth_year int, i_min_klass boolean)
language sql security definer set search_path = '' stable as $$
  with q as (select nullif(trim(coalesce(p_query, '')), '') as term)
  select 'medlem'::text, m.user_id, null::uuid,
         coalesce(nullif(p.display_name, ''), 'Medlem'),
         coalesce(p.avatar_color, '#6c4cf1'),
         null::int,
         exists (select 1 from public.klass_elev e
                   join public.klass k on k.id = e.klass_id
                  where e.student_user_id = m.user_id and k.larare_user_id = auth.uid() and not k.archived)
    from public.membership m
    join public.profiles p on p.id = m.user_id
   cross join q
   where m.forening_id = p_forening and m.role = 'ungdom'
     and (private.is_larare(p_forening) or private.has_forening_role(p_forening, 'ledare'))
     and (q.term is null or p.display_name ilike '%' || q.term || '%')
  union all
  select 'barn'::text, null::uuid, c.id,
         coalesce(nullif(c.display_name, ''), 'Barn'),
         coalesce(c.avatar_color, '#6c4cf1'),
         c.birth_year,
         exists (select 1 from public.klass_elev e
                   join public.klass k on k.id = e.klass_id
                  where e.child_id = c.id and k.larare_user_id = auth.uid() and not k.archived)
    from public.child c
   cross join q
   where c.forening_id = p_forening
     and (private.is_larare(p_forening) or private.has_forening_role(p_forening, 'ledare'))
     and (q.term is null or c.display_name ilike '%' || q.term || '%')
   order by 4
   limit 100;
$$;
grant execute on function public.forening_elever(uuid, text) to authenticated;

create or replace function public.add_klass_elev(
  p_klass uuid, p_user uuid default null, p_child uuid default null
) returns public.klass_elev language plpgsql security definer set search_path = '' as $$
declare
  k public.klass; e public.klass_elev; f public.forening;
  v_name text; v_notify uuid;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if num_nonnulls(p_user, p_child) <> 1 then raise exception 'Ange antingen en medlem eller ett barn'; end if;

  select * into k from public.klass where id = p_klass and not archived;
  if not found then raise exception 'Klassen finns inte'; end if;
  if not private.kan_styra_klass(p_klass) then raise exception 'Det här är inte din klass'; end if;
  select * into f from public.forening where id = k.forening_id;

  if p_child is not null then
    select display_name, parent_user_id into v_name, v_notify
      from public.child where id = p_child and forening_id = k.forening_id;
    if v_name is null then raise exception 'Eleven tillhör inte föreningen'; end if;
  else
    select coalesce(nullif(p.display_name, ''), 'Medlem') into v_name
      from public.membership m join public.profiles p on p.id = m.user_id
     where m.user_id = p_user and m.forening_id = k.forening_id and m.role = 'ungdom';
    if v_name is null then raise exception 'Eleven tillhör inte föreningen'; end if;
    v_notify := p_user;
  end if;

  insert into public.klass_elev (klass_id, forening_id, student_user_id, child_id, added_by)
  values (p_klass, k.forening_id, p_user, p_child, auth.uid())
  on conflict do nothing
  returning * into e;
  if e.id is null then raise exception '% går redan i klassen', v_name; end if;

  -- Insyn: eleven/föräldern får veta direkt och kan säga ifrån.
  insert into public.notification (forening_id, user_id, icon, tint, title, body)
  values (k.forening_id, v_notify, 'user', '#ede7ff', 'Tillagd i ' || k.name,
          v_name || ' är nu med i klassen ' || k.name || ' i ' || f.name || '.');

  return e;
end $$;
grant execute on function public.add_klass_elev(uuid, uuid, uuid) to authenticated;

create or replace function public.remove_klass_elev(p_klass_elev uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.klass_elev;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  select * into e from public.klass_elev where id = p_klass_elev;
  if not found then raise exception 'Eleven finns inte i klassen'; end if;
  if not private.kan_styra_klass(e.klass_id) then raise exception 'Det här är inte din klass'; end if;
  delete from public.klass_elev where id = p_klass_elev;
end $$;
grant execute on function public.remove_klass_elev(uuid) to authenticated;

-- "Det stämmer inte" — eleven själv eller barnets förälder tar bort placeringen
-- och läraren får veta. Utan den här vore adoptionen ensidig.
create or replace function public.neka_klassplacering(p_klass_elev uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.klass_elev; k public.klass; v_name text; v_ok boolean;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  select * into e from public.klass_elev where id = p_klass_elev;
  if not found then raise exception 'Placeringen finns inte'; end if;
  select * into k from public.klass where id = e.klass_id;

  if e.student_user_id is not null then
    v_ok := e.student_user_id = auth.uid();
    select coalesce(nullif(display_name, ''), 'Eleven') into v_name from public.profiles where id = e.student_user_id;
  else
    select (c.parent_user_id = auth.uid()), coalesce(nullif(c.display_name, ''), 'Eleven')
      into v_ok, v_name from public.child c where c.id = e.child_id;
  end if;
  if not coalesce(v_ok, false) then raise exception 'Du kan bara ta bort din egen placering'; end if;

  delete from public.klass_elev where id = p_klass_elev;

  if k.larare_user_id is not null then
    insert into public.notification (forening_id, user_id, icon, tint, title, body)
    values (k.forening_id, k.larare_user_id, 'shield', '#fee2e2', 'Placering borttagen',
            v_name || ' togs bort ur ' || k.name || ' på egen begäran.');
  end if;
end $$;
grant execute on function public.neka_klassplacering(uuid) to authenticated;

-- Gå med i en klass med klasskoden (eleven själv, eller förälder för sitt barn).
create or replace function public.join_klass_by_code(p_code text, p_child uuid default null)
returns public.klass_elev language plpgsql security definer set search_path = '' as $$
declare k public.klass; e public.klass_elev; v_name text;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  select * into k from public.klass where join_code = upper(trim(p_code)) and not archived;
  if not found then raise exception 'Ogiltig klasskod'; end if;

  if p_child is not null then
    select coalesce(nullif(display_name, ''), 'Barn') into v_name from public.child
     where id = p_child and parent_user_id = auth.uid() and forening_id = k.forening_id;
    if v_name is null then raise exception 'Barnet tillhör inte föreningen'; end if;
  else
    if not exists (select 1 from public.membership m
                    where m.user_id = auth.uid() and m.forening_id = k.forening_id and m.role = 'ungdom') then
      raise exception 'Du är inte medlem i klassens förening';
    end if;
    select coalesce(nullif(display_name, ''), 'Medlem') into v_name from public.profiles where id = auth.uid();
  end if;

  insert into public.klass_elev (klass_id, forening_id, student_user_id, child_id, added_by)
  values (k.id, k.forening_id, case when p_child is null then auth.uid() end, p_child, auth.uid())
  on conflict do nothing
  returning * into e;
  if e.id is null then raise exception 'Redan med i klassen'; end if;

  if k.larare_user_id is not null then
    insert into public.notification (forening_id, user_id, icon, tint, title, body)
    values (k.forening_id, k.larare_user_id, 'user', '#ede7ff', 'Ny elev i ' || k.name,
            v_name || ' gick med med klasskoden.');
  end if;
  return e;
end $$;
grant execute on function public.join_klass_by_code(text, uuid) to authenticated;

-- Klassens elever med stjärnstatistik.
create or replace function public.klass_elever(p_klass uuid)
returns table (id uuid, student_user_id uuid, child_id uuid, name text, avatar_color text,
               level int, stjarnor_veckan int, stjarnor_totalt int)
language sql security definer set search_path = '' stable as $$
  select e.id, e.student_user_id, e.child_id,
         coalesce(nullif(p.display_name, ''), nullif(c.display_name, ''), 'Elev'),
         coalesce(p.avatar_color, c.avatar_color, '#6c4cf1'),
         coalesce(m.level, c.level, 1)::int,
         (select coalesce(sum(s.stars), 0) from public.stjarna s
           where s.voided_at is null and s.created_at >= date_trunc('week', now())
             and (s.student_user_id = e.student_user_id or s.child_id = e.child_id))::int,
         (select coalesce(sum(s.stars), 0) from public.stjarna s
           where s.voided_at is null
             and (s.student_user_id = e.student_user_id or s.child_id = e.child_id))::int
    from public.klass_elev e
    left join public.profiles p on p.id = e.student_user_id
    left join public.membership m on m.user_id = e.student_user_id and m.forening_id = e.forening_id
    left join public.child c on c.id = e.child_id
   where e.klass_id = p_klass and private.kan_styra_klass(p_klass)
   order by 4;
$$;
grant execute on function public.klass_elever(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- LÄRARE: lektionen
-- ---------------------------------------------------------------------

-- Öppna (eller återöppna) dagens lektion. Alla elever läggs in som närvarande
-- direkt — läraren behöver bara pricka av de som saknas, vilket är den
-- vanligaste vägen och håller lektionen under en minut.
create or replace function public.start_lektion(p_klass uuid, p_datum date default null)
returns public.lektion language plpgsql security definer set search_path = '' as $$
declare k public.klass; l public.lektion; d date := coalesce(p_datum, current_date);
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  select * into k from public.klass where id = p_klass and not archived;
  if not found then raise exception 'Klassen finns inte'; end if;
  if not private.kan_styra_klass(p_klass) then raise exception 'Det här är inte din klass'; end if;
  if d > current_date then raise exception 'Går inte att hålla en lektion i framtiden'; end if;

  insert into public.lektion (klass_id, forening_id, larare_user_id, held_on)
  values (p_klass, k.forening_id, auth.uid(), d)
  on conflict (klass_id, held_on) do update set klass_id = excluded.klass_id
  returning * into l;

  if l.closed_at is not null then raise exception 'Lektionen den % är redan avslutad', d; end if;

  insert into public.lektion_narvaro (lektion_id, klass_elev_id, status)
  select l.id, e.id, 'har' from public.klass_elev e where e.klass_id = p_klass
  on conflict (lektion_id, klass_elev_id) do nothing;

  return l;
end $$;
grant execute on function public.start_lektion(uuid, date) to authenticated;

-- Lektionens lista: elev, närvaro och den stjärnsättning som ligger som utkast.
create or replace function public.lektion_lista(p_lektion uuid)
returns table (klass_elev_id uuid, name text, avatar_color text, status text,
               stjarna_id uuid, stars int, kategori text, note text)
language sql security definer set search_path = '' stable as $$
  select e.id,
         coalesce(nullif(p.display_name, ''), nullif(c.display_name, ''), 'Elev'),
         coalesce(p.avatar_color, c.avatar_color, '#6c4cf1'),
         coalesce(n.status, 'har'),
         s.id, s.stars::int, s.kategori, s.note
    from public.lektion l
    join public.klass_elev e on e.klass_id = l.klass_id
    left join public.lektion_narvaro n on n.lektion_id = l.id and n.klass_elev_id = e.id
    left join public.profiles p on p.id = e.student_user_id
    left join public.child c on c.id = e.child_id
    left join public.stjarna s on s.lektion_id = l.id and s.voided_at is null
         and (s.student_user_id = e.student_user_id or s.child_id = e.child_id)
   where l.id = p_lektion and private.kan_styra_klass(l.klass_id)
   order by 2;
$$;
grant execute on function public.lektion_lista(uuid) to authenticated;

create or replace function public.set_narvaro(p_lektion uuid, p_klass_elev uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare l public.lektion;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if p_status not in ('har','sen','borta','anmald') then raise exception 'Ogiltig närvarostatus'; end if;
  select * into l from public.lektion where id = p_lektion;
  if not found then raise exception 'Lektionen finns inte'; end if;
  if not private.kan_styra_klass(l.klass_id) then raise exception 'Det här är inte din klass'; end if;
  if l.closed_at is not null then raise exception 'Lektionen är avslutad'; end if;

  insert into public.lektion_narvaro (lektion_id, klass_elev_id, status)
  values (p_lektion, p_klass_elev, p_status)
  on conflict (lektion_id, klass_elev_id) do update set status = excluded.status;
end $$;
grant execute on function public.set_narvaro(uuid, uuid, text) to authenticated;

-- Sätt (eller nolla) stjärnorna för en elev på en pågående lektion.
-- Inget XP delas ut här — det sker i avsluta_lektion(). Därför kan läraren
-- ändra sig hur många gånger som helst utan att historiken fylls av ångrade
-- rader. p_stars = 0 tar bort utkastet.
create or replace function public.satt_lektion_stjarnor(
  p_lektion uuid, p_klass_elev uuid, p_stars int,
  p_kategori text default 'hifz', p_note text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  l public.lektion; e public.klass_elev; f public.forening;
  redan int; befintlig uuid;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  select * into l from public.lektion where id = p_lektion;
  if not found then raise exception 'Lektionen finns inte'; end if;
  if not private.kan_styra_klass(l.klass_id) then raise exception 'Det här är inte din klass'; end if;
  if l.closed_at is not null then raise exception 'Lektionen är avslutad'; end if;

  select * into e from public.klass_elev where id = p_klass_elev and klass_id = l.klass_id;
  if not found then raise exception 'Eleven går inte i klassen'; end if;
  select * into f from public.forening where id = l.forening_id;

  select s.id into befintlig from public.stjarna s
   where s.lektion_id = l.id and s.voided_at is null
     and (s.student_user_id = e.student_user_id or s.child_id = e.child_id);

  if coalesce(p_stars, 0) <= 0 then
    delete from public.stjarna where id = befintlig and granted_at is null;
    return;
  end if;
  if p_stars > 5 then raise exception 'Högst 5 stjärnor'; end if;
  if p_kategori not in ('hifz','murajaa','tajwid','laxa','narvaro','adab') then
    raise exception 'Okänd kategori';
  end if;

  -- Veckotak per lärare och elev (inflationsspärr).
  select coalesce(sum(s.stars), 0) into redan from public.stjarna s
   where s.larare_user_id = auth.uid() and s.voided_at is null
     and s.created_at >= date_trunc('week', now())
     and (s.id is distinct from befintlig)
     and (s.student_user_id = e.student_user_id or s.child_id = e.child_id);
  if redan + p_stars > f.star_max_per_vecka then
    raise exception 'Veckans stjärntak (%) är nått för den här eleven', f.star_max_per_vecka;
  end if;

  if befintlig is not null then
    update public.stjarna
       set stars = p_stars, kategori = p_kategori,
           note = nullif(trim(coalesce(p_note, '')), ''), larare_user_id = auth.uid()
     where id = befintlig;
  else
    insert into public.stjarna (forening_id, klass_id, lektion_id, larare_user_id,
                                student_user_id, child_id, stars, kategori, note)
    values (l.forening_id, l.klass_id, l.id, auth.uid(),
            e.student_user_id, e.child_id, p_stars, p_kategori,
            nullif(trim(coalesce(p_note, '')), ''));
  end if;
end $$;
grant execute on function public.satt_lektion_stjarnor(uuid, uuid, int, text, text) to authenticated;

-- Avsluta lektionen: ETT tryck skriver närvaro, XP, ev. poäng och notiser.
create or replace function public.avsluta_lektion(p_lektion uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  l public.lektion; k public.klass; f public.forening;
  r record;
  v_xp int; v_points int; v_notify uuid; v_name text;
  n_narvarande int := 0; n_stjarnor int := 0; n_xp int := 0;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  select * into l from public.lektion where id = p_lektion for update;
  if not found then raise exception 'Lektionen finns inte'; end if;
  if not private.kan_styra_klass(l.klass_id) then raise exception 'Det här är inte din klass'; end if;
  if l.closed_at is not null then raise exception 'Lektionen är redan avslutad'; end if;

  select * into k from public.klass where id = l.klass_id;
  select * into f from public.forening where id = l.forening_id;

  -- 1) Närvaro → incheckning, så att streak, besök och Mål-uppdrag lever
  --    vidare i det befintliga systemet i stället för i ett parallellt spår.
  --    Noll poäng: XP:t kommer från stjärnorna, butiksvalutan från aktiviteter.
  for r in
    select e.student_user_id, e.child_id
      from public.lektion_narvaro n
      join public.klass_elev e on e.id = n.klass_elev_id
     where n.lektion_id = l.id and n.status in ('har','sen')
  loop
    n_narvarande := n_narvarande + 1;
    perform private.bump_streak(l.forening_id, r.student_user_id, r.child_id);   -- före insert
    insert into public.checkin (forening_id, user_id, child_id, title, awarded_points, awarded_xp)
    values (l.forening_id, coalesce(r.student_user_id, auth.uid()), r.child_id, k.name, 0, 0);
  end loop;

  -- 2) Stjärnutkasten → XP (och ev. poäng) + notis till eleven/föräldern.
  for r in
    select s.* from public.stjarna s
     where s.lektion_id = l.id and s.granted_at is null and s.voided_at is null
  loop
    v_xp     := private.star_xp(l.forening_id, r.stars);
    v_points := floor(v_xp * f.star_points_factor)::int;

    perform private.apply_xp(l.forening_id, r.student_user_id, r.child_id, v_xp);
    if v_points > 0 then
      insert into public.points_ledger (forening_id, user_id, child_id, delta, reason)
      values (l.forening_id, coalesce(r.student_user_id, auth.uid()), r.child_id, v_points,
              'stjarna:' || r.id::text);
    end if;

    update public.stjarna set xp = v_xp, points = v_points, granted_at = now() where id = r.id;
    n_stjarnor := n_stjarnor + r.stars;
    n_xp := n_xp + v_xp;

    if r.child_id is not null then
      select c.parent_user_id, coalesce(nullif(c.display_name, ''), 'Ditt barn')
        into v_notify, v_name from public.child c where c.id = r.child_id;
    else
      v_notify := r.student_user_id;
      v_name := null;
    end if;

    if v_notify is not null then
      insert into public.notification (forening_id, user_id, icon, tint, title, body)
      values (l.forening_id, v_notify, 'sparkles', '#fef9c3',
              coalesce(v_name || ': ', '') || repeat('★', r.stars) || ' i ' || k.name,
              '+' || v_xp || ' XP' || coalesce(' · ' || r.note, ''));
    end if;
  end loop;

  update public.lektion set closed_at = now() where id = l.id;

  return jsonb_build_object('narvarande', n_narvarande, 'stjarnor', n_stjarnor,
                            'xp', n_xp, 'klass', k.name);
end $$;
grant execute on function public.avsluta_lektion(uuid) to authenticated;

-- Fristående stjärna utanför lektionen (t.ex. läxa inlämnad mellan gångerna).
-- Delas ut direkt eftersom det inte finns någon lektion att avsluta.
create or replace function public.ge_stjarna(
  p_klass_elev uuid, p_stars int, p_kategori text default 'laxa', p_note text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e public.klass_elev; k public.klass; f public.forening;
  v_xp int; v_points int; v_id uuid; v_notify uuid; v_name text; redan int;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if p_stars is null or p_stars < 1 or p_stars > 5 then raise exception 'Ange 1–5 stjärnor'; end if;
  if p_kategori not in ('hifz','murajaa','tajwid','laxa','narvaro','adab') then
    raise exception 'Okänd kategori';
  end if;

  select * into e from public.klass_elev where id = p_klass_elev;
  if not found then raise exception 'Eleven finns inte i klassen'; end if;
  if not private.kan_styra_klass(e.klass_id) then raise exception 'Det här är inte din klass'; end if;
  select * into k from public.klass where id = e.klass_id;
  select * into f from public.forening where id = e.forening_id;

  select coalesce(sum(s.stars), 0) into redan from public.stjarna s
   where s.larare_user_id = auth.uid() and s.voided_at is null
     and s.created_at >= date_trunc('week', now())
     and (s.student_user_id = e.student_user_id or s.child_id = e.child_id);
  if redan + p_stars > f.star_max_per_vecka then
    raise exception 'Veckans stjärntak (%) är nått för den här eleven', f.star_max_per_vecka;
  end if;

  v_xp     := private.star_xp(e.forening_id, p_stars);
  v_points := floor(v_xp * f.star_points_factor)::int;

  insert into public.stjarna (forening_id, klass_id, larare_user_id, student_user_id, child_id,
                              stars, kategori, note, xp, points, granted_at)
  values (e.forening_id, e.klass_id, auth.uid(), e.student_user_id, e.child_id,
          p_stars, p_kategori, nullif(trim(coalesce(p_note, '')), ''), v_xp, v_points, now())
  returning id into v_id;

  perform private.apply_xp(e.forening_id, e.student_user_id, e.child_id, v_xp);
  if v_points > 0 then
    insert into public.points_ledger (forening_id, user_id, child_id, delta, reason)
    values (e.forening_id, coalesce(e.student_user_id, auth.uid()), e.child_id, v_points,
            'stjarna:' || v_id::text);
  end if;

  if e.child_id is not null then
    select c.parent_user_id, coalesce(nullif(c.display_name, ''), 'Ditt barn')
      into v_notify, v_name from public.child c where c.id = e.child_id;
  else
    v_notify := e.student_user_id;
  end if;
  if v_notify is not null then
    insert into public.notification (forening_id, user_id, icon, tint, title, body)
    values (e.forening_id, v_notify, 'sparkles', '#fef9c3',
            coalesce(v_name || ': ', '') || repeat('★', p_stars) || ' i ' || k.name,
            '+' || v_xp || ' XP' || coalesce(' · ' || nullif(trim(coalesce(p_note, '')), ''), ''));
  end if;

  return jsonb_build_object('xp', v_xp, 'points', v_points, 'stars', p_stars);
end $$;
grant execute on function public.ge_stjarna(uuid, int, text, text) to authenticated;

-- Ångra en stjärna. Raden ligger kvar som ångrad och XP/poäng backas ut.
create or replace function public.angra_stjarna(p_stjarna uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.stjarna;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  select * into s from public.stjarna where id = p_stjarna for update;
  if not found then raise exception 'Stjärnan finns inte'; end if;
  if s.voided_at is not null then raise exception 'Redan ångrad'; end if;
  if not (s.larare_user_id = auth.uid() or private.has_forening_role(s.forening_id, 'ledare')) then
    raise exception 'Bara läraren som satte stjärnan kan ångra den';
  end if;

  if s.granted_at is not null then
    perform private.apply_xp(s.forening_id, s.student_user_id, s.child_id, -s.xp);
    if s.points > 0 then
      insert into public.points_ledger (forening_id, user_id, child_id, delta, reason)
      values (s.forening_id, coalesce(s.student_user_id, auth.uid()), s.child_id, -s.points,
              'stjarna-angrad:' || s.id::text);
    end if;
  end if;

  update public.stjarna set voided_at = now(), voided_by = auth.uid() where id = s.id;
end $$;
grant execute on function public.angra_stjarna(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- ELEV / FÖRÄLDER / LÄRARE: se stjärnor och klasser
-- Samma två funktioner för alla fyra rollerna — vem som får läsa avgörs av
-- private.kan_se_elev(), inte av vilken skärm som ringer.
-- ---------------------------------------------------------------------

create or replace function public.elev_klasser(p_user uuid default null, p_child uuid default null)
returns table (klass_elev_id uuid, klass_id uuid, name text, larare text, weekday smallint,
               time_text text, color text, stjarnor_veckan int, stjarnor_totalt int)
language sql security definer set search_path = '' stable as $$
  select e.id, k.id, k.name,
         coalesce(nullif(p.display_name, ''), 'Lärare'),
         k.weekday, k.time_text, k.color,
         (select coalesce(sum(s.stars), 0) from public.stjarna s
           where s.klass_id = k.id and s.voided_at is null
             and s.created_at >= date_trunc('week', now())
             and (s.student_user_id = e.student_user_id or s.child_id = e.child_id))::int,
         (select coalesce(sum(s.stars), 0) from public.stjarna s
           where s.klass_id = k.id and s.voided_at is null
             and (s.student_user_id = e.student_user_id or s.child_id = e.child_id))::int
    from public.klass_elev e
    join public.klass k on k.id = e.klass_id and not k.archived
    left join public.profiles p on p.id = k.larare_user_id
   where private.kan_se_elev(coalesce(p_user, auth.uid()), p_child)
     and ((p_child is not null and e.child_id = p_child)
          or (p_child is null and e.student_user_id = coalesce(p_user, auth.uid())))
   order by k.weekday nulls last, k.name;
$$;
grant execute on function public.elev_klasser(uuid, uuid) to authenticated;

create or replace function public.elev_stjarnor(
  p_user uuid default null, p_child uuid default null, p_limit int default 40
)
returns table (id uuid, stars int, kategori text, note text, xp int, klass text,
               larare text, created_at timestamptz, angrad boolean)
language sql security definer set search_path = '' stable as $$
  select s.id, s.stars::int, s.kategori, s.note, s.xp,
         coalesce(k.name, 'Klass'),
         coalesce(nullif(p.display_name, ''), 'Lärare'),
         coalesce(s.granted_at, s.created_at),
         s.voided_at is not null
    from public.stjarna s
    left join public.klass k on k.id = s.klass_id
    left join public.profiles p on p.id = s.larare_user_id
   where private.kan_se_elev(coalesce(p_user, auth.uid()), p_child)
     and s.granted_at is not null
     and ((p_child is not null and s.child_id = p_child)
          or (p_child is null and s.student_user_id = coalesce(p_user, auth.uid())))
   order by coalesce(s.granted_at, s.created_at) desc
   limit greatest(coalesce(p_limit, 40), 1);
$$;
grant execute on function public.elev_stjarnor(uuid, uuid, int) to authenticated;

-- Klasstopplista för veckan. Nollställs varje vecka, så alla kan vinna.
create or replace function public.klass_topplista(p_klass uuid)
returns table (rank int, name text, avatar_color text, stjarnor int, is_me boolean)
language sql security definer set search_path = '' stable as $$
  with rader as (
    select coalesce(nullif(p.display_name, ''), nullif(c.display_name, ''), 'Elev') as name,
           coalesce(p.avatar_color, c.avatar_color, '#6c4cf1') as avatar_color,
           (select coalesce(sum(s.stars), 0) from public.stjarna s
             where s.klass_id = p_klass and s.voided_at is null
               and s.created_at >= date_trunc('week', now())
               and (s.student_user_id = e.student_user_id or s.child_id = e.child_id))::int as stjarnor,
           (e.student_user_id = auth.uid()
            or exists (select 1 from public.child ch
                        where ch.id = e.child_id and ch.parent_user_id = auth.uid())) as is_me
      from public.klass_elev e
      left join public.profiles p on p.id = e.student_user_id
      left join public.child c on c.id = e.child_id
     where e.klass_id = p_klass
       and (private.kan_styra_klass(p_klass)
            or exists (select 1 from public.klass_elev me
                        where me.klass_id = p_klass
                          and (me.student_user_id = auth.uid()
                               or exists (select 1 from public.child ch
                                           where ch.id = me.child_id and ch.parent_user_id = auth.uid()))))
  )
  select (row_number() over (order by r.stjarnor desc, r.name))::int,
         r.name, r.avatar_color, r.stjarnor, coalesce(r.is_me, false)
    from rader r
   order by 1
   limit 30;
$$;
grant execute on function public.klass_topplista(uuid) to authenticated;

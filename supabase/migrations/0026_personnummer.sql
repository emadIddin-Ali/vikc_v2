-- =====================================================================
-- LEVLA — 0026 personnummer (register per förening)
--
-- En ledare/admin kan slå på "Kräv personnummer" för sin förening. Då måste
-- man ange personnummer när man går med (ungdom eller förälder) och när en
-- förälder lägger till ett barn. Föreningen får därmed ett register.
--
-- KÄNSLIGA UPPGIFTER: personnummer är särskilt skyddsvärt (GDPR art. 87 +
-- 3 kap. 10 § dataskyddslagen). Åtkomst begränsas av RLS:
--   * membership.personnummer  — syns för egen användare + ledare/kommun
--     (membership_select från 0024).
--   * child.personnummer       — syns för föräldern + ledare (child_select).
-- Måste dokumenteras i integritetspolicyn + registerförteckningen (art. 30).
--
-- Kör efter 0024/0025.
-- =====================================================================

-- ---------------------------------------------------------------------
-- SPÄRR — kör inte på en databas som redan har lärarrollen.
--
-- 0028 byggde ut join_forening_by_code med rollen 'larare', och 0031 la till
-- week_streak i my_children. Båda definieras om här i sina äldre versioner,
-- så en omkörning skulle ta bort möjligheten att gå med som lärare och få
-- förälderns vy att tappa veckosviten.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
              where t.typname = 'app_role' and e.enumlabel = 'larare') then
    raise exception 'Databasen har redan lärarrollen (0027+ är körd). Kör INTE om 0026 — den skulle skriva över join_forening_by_code och my_children med äldre versioner. Kör supabase/diagnostik.sql för att se vad som saknas.';
  end if;
end $$;

-- ---------- schema ----------
alter table public.forening   add column if not exists require_personnummer boolean not null default false;
alter table public.membership add column if not exists personnummer text;
alter table public.child      add column if not exists personnummer text;

-- ---------- validering ----------
-- Rensar bort allt utom siffror.
create or replace function private.pnr_digits(p text)
returns text language sql immutable set search_path = '' as $$
  select regexp_replace(coalesce(p, ''), '\D', '', 'g');
$$;

-- Giltigt svenskt person-/samordningsnummer: 10 eller 12 siffror, Luhn-kontroll
-- på de sista 10. (Samordningsnummer har dag + 60, Luhn gäller ändå.)
create or replace function private.valid_pnr(p text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  d text := private.pnr_digits(p);
  core text; sum int := 0; n int; i int; dig int;
begin
  if length(d) = 12 then core := substr(d, 3, 10);
  elsif length(d) = 10 then core := d;
  else return false; end if;

  for i in 1..10 loop
    dig := substr(core, i, 1)::int;
    n := dig * (case when i % 2 = 1 then 2 else 1 end);
    if n > 9 then n := n - 9; end if;
    sum := sum + n;
  end loop;
  return sum % 10 = 0;
end $$;

grant execute on function private.pnr_digits(text) to authenticated;
grant execute on function private.valid_pnr(text) to authenticated;

-- ---------- gå med (ungdom/förälder) med ev. personnummer ----------
drop function if exists public.join_forening_by_code(text, text);
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
  if p_role not in ('ungdom', 'foralder') then raise exception 'Ogiltig roll'; end if;

  select * into f from public.forening where join_code = upper(trim(p_code));
  if not found then raise exception 'Ogiltig föreningskod'; end if;

  if f.require_personnummer and pnr is null then
    raise exception 'Föreningen kräver personnummer';
  end if;
  if pnr is not null and not private.valid_pnr(pnr) then
    raise exception 'Ogiltigt personnummer';
  end if;

  insert into public.membership (user_id, forening_id, role, personnummer)
  values (auth.uid(), f.id, p_role::public.app_role, pnr)
  on conflict (user_id, forening_id)
    do update set personnummer = coalesce(excluded.personnummer, public.membership.personnummer)
  returning * into m;

  return m;
end $$;
grant execute on function public.join_forening_by_code(text, text, text) to authenticated;

-- ---------- barn-CRUD med personnummer ----------
drop function if exists public.add_child(uuid, text, int, text);
create or replace function public.add_child(
  p_forening uuid, p_name text, p_birth_year int default null,
  p_color text default '#6c4cf1', p_personnummer text default null
)
returns public.child language plpgsql security definer set search_path = '' as $$
declare
  c public.child;
  f public.forening;
  pnr text := nullif(private.pnr_digits(p_personnummer), '');
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not exists (
    select 1 from public.membership m
     where m.user_id = auth.uid() and m.forening_id = p_forening and m.role = 'foralder'
  ) then raise exception 'Bara föräldrar kan lägga till barn'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'Skriv ett namn'; end if;

  select * into f from public.forening where id = p_forening;
  if f.require_personnummer and pnr is null then
    raise exception 'Föreningen kräver personnummer';
  end if;
  if pnr is not null and not private.valid_pnr(pnr) then
    raise exception 'Ogiltigt personnummer';
  end if;

  insert into public.child (forening_id, parent_user_id, display_name, avatar_color, birth_year, personnummer)
  values (p_forening, auth.uid(), trim(p_name),
          coalesce(nullif(trim(coalesce(p_color, '')), ''), '#6c4cf1'), p_birth_year, pnr)
  returning * into c;
  return c;
end $$;
grant execute on function public.add_child(uuid, text, int, text, text) to authenticated;

drop function if exists public.update_child(uuid, text, int, text);
create or replace function public.update_child(
  p_child uuid, p_name text, p_birth_year int default null,
  p_color text default null, p_personnummer text default null
)
returns public.child language plpgsql security definer set search_path = '' as $$
declare
  c public.child;
  pnr text := nullif(private.pnr_digits(p_personnummer), '');
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  select * into c from public.child where id = p_child and parent_user_id = auth.uid();
  if not found then raise exception 'Barnet finns inte'; end if;
  if pnr is not null and not private.valid_pnr(pnr) then
    raise exception 'Ogiltigt personnummer';
  end if;

  update public.child set
    display_name = coalesce(nullif(trim(coalesce(p_name, '')), ''), display_name),
    birth_year   = p_birth_year,
    avatar_color = coalesce(nullif(trim(coalesce(p_color, '')), ''), avatar_color),
    personnummer = coalesce(pnr, personnummer)
  where id = p_child
  returning * into c;
  return c;
end $$;
grant execute on function public.update_child(uuid, text, int, text, text) to authenticated;

-- ---------- my_children: ta med personnummer (föräldern ser sina barns) ----------
drop function if exists public.my_children(uuid);
create or replace function public.my_children(p_forening uuid)
returns table (id uuid, display_name text, avatar_color text, birth_year int, personnummer text, points int, xp int, level int, streak int, visits int)
language sql security definer set search_path = '' stable as $$
  select c.id, c.display_name, c.avatar_color, c.birth_year, c.personnummer, c.points, c.xp, c.level, c.streak, c.visits
    from public.child c
   where c.parent_user_id = auth.uid() and c.forening_id = p_forening
   order by c.display_name;
$$;
grant execute on function public.my_children(uuid) to authenticated;

-- ---------- ledare: slå på/av kravet ----------
create or replace function public.set_forening_require_personnummer(p_forening uuid, p_require boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not private.has_forening_role(p_forening, 'ledare') then
    raise exception 'Endast ledare kan ändra detta';
  end if;
  update public.forening set require_personnummer = coalesce(p_require, false) where id = p_forening;
end $$;
grant execute on function public.set_forening_require_personnummer(uuid, boolean) to authenticated;

-- ---------- ledare: registret (medlemmar + barn med personnummer) ----------
create or replace function public.ledare_register(p_forening uuid)
returns table (kind text, name text, role text, personnummer text, birth_year int)
language sql security definer set search_path = '' stable as $$
  select 'medlem'::text,
         coalesce(nullif(p.display_name, ''), 'Medlem'),
         m.role::text,
         m.personnummer,
         null::int
    from public.membership m
    join public.profiles p on p.id = m.user_id
   where m.forening_id = p_forening
     and private.has_forening_role(p_forening, 'ledare')
  union all
  select 'barn'::text,
         coalesce(nullif(c.display_name, ''), 'Barn'),
         'barn'::text,
         c.personnummer,
         c.birth_year
    from public.child c
   where c.forening_id = p_forening
     and private.has_forening_role(p_forening, 'ledare')
  order by 1, 2;
$$;
grant execute on function public.ledare_register(uuid) to authenticated;

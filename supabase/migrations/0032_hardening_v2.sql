-- =====================================================================
-- LEVLA — 0032 säkerhetsgranskning av 0027–0031
--
-- Genomgång av allt som tillkommit efter härdningen i 0024 (lärarroll,
-- klasser, stjärnor, marknad, XP-ekonomi). Fynden:
--
--   H1  MUTERANDE PRIVATA HJÄLPARE VAR KÖRBARA FÖR APPROLLEN.
--       private.apply_xp, private.bump_streak och private.log_xp skriver
--       XP, nivå, streak och huvudboken — och hade EXECUTE för
--       authenticated. PostgREST exponerar bara schemat public, så de gick
--       inte att nå över API:et idag, men grantet är onödigt och skulle bli
--       en direkt väg till obegränsad XP om private någonsin exponeras
--       eller om en definer-funktion råkar ta emot dynamisk SQL. Återkallas.
--
--   H2  EN LEDARE KUNDE TRYCKA POÄNG GENOM NEGATIVA BELOPP.
--       reward.cost saknade villkor. Med cost = -100 blev uttaget
--       "delta = -cost" = +100 poäng, och saldokontrollen (saldo < cost)
--       passerade alltid. Samma sak för activity.points och mission.xp, som
--       kunde göra medlemmars saldo och XP negativa. Nu >= 0.
--
--   M1  EN LÄCKT FÖRENINGSKOD VAR PERMANENT. Koden går att sprida vidare i
--       en gruppchatt och det fanns inget sätt att byta den. rotate_join_code
--       ger ledaren en ny kod utan att röra befintliga medlemskap.
--
--   M2  EN KLASS UTAN LÄRARE GICK INTE ATT RÄDDA. klass.larare_user_id
--       nollställs när läraren raderar sitt konto (avsiktligt — historiken
--       ska överleva), men tilldela_klass saknade både user_id i ledarens
--       vy och knapp i appen. ledare_klasser returnerar nu lärarens id.
--
-- Granskat och befunnet korrekt: RLS på samtliga 26 tabeller, samtliga 93
-- SECURITY DEFINER-funktioner (de utan behörighetskontroll är enbart
-- triggerfunktioner, som PostgREST inte exponerar), personnummer-åtkomsten,
-- barn-i-butiken-vägen och lärarens begränsade sikt (en lärare kan varken
-- läsa medlemsregistret, andras incheckningar eller barn utanför sina egna
-- klasser).
--
-- Kräver 0031. Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- H1 — muterande hjälpare ska inte vara körbara för approllen.
-- SECURITY DEFINER-funktionerna som anropar dem kör som ägaren och
-- påverkas inte av att grantet försvinner.
-- ---------------------------------------------------------------------
revoke execute on function private.apply_xp(uuid, uuid, uuid, int)   from anon, authenticated, public;
revoke execute on function private.bump_streak(uuid, uuid, uuid)     from anon, authenticated, public;
revoke execute on function private.log_xp(uuid, uuid, uuid, int, text) from anon, authenticated, public;

-- ---------------------------------------------------------------------
-- H2 — inga negativa belopp i ekonomin
-- ---------------------------------------------------------------------
alter table public.reward drop constraint if exists reward_cost_check;
alter table public.reward add constraint reward_cost_check check (cost >= 0);

alter table public.activity drop constraint if exists activity_points_check;
alter table public.activity add constraint activity_points_check check (points >= 0);

alter table public.mission drop constraint if exists mission_xp_check;
alter table public.mission add constraint mission_xp_check check (xp >= 0 and goal >= 1);

-- ---------------------------------------------------------------------
-- M1 — byt föreningskod
-- Medlemskapen är kopplade till forening_id, inte till koden, så ingen
-- tappar sin plats när koden byts.
-- ---------------------------------------------------------------------
create or replace function public.rotate_join_code(p_forening uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare kod text;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not private.has_forening_role(p_forening, 'ledare') then
    raise exception 'Bara ledare kan byta föreningskod';
  end if;

  loop
    kod := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.forening f where f.join_code = kod);
  end loop;

  update public.forening set join_code = kod where id = p_forening;
  return kod;
end $$;
grant execute on function public.rotate_join_code(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- M2 — ledaren behöver se vem som äger klassen för att kunna byta lärare
-- ---------------------------------------------------------------------
drop function if exists public.ledare_klasser(uuid);
create or replace function public.ledare_klasser(p_forening uuid)
returns table (id uuid, name text, larare text, larare_user_id uuid, weekday smallint,
               time_text text, color text, elever int, stjarnor_30d int, senaste_lektion date)
language sql security definer set search_path = '' stable as $$
  select k.id, k.name,
         coalesce(nullif(p.display_name, ''), 'Ingen lärare'),
         k.larare_user_id,
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

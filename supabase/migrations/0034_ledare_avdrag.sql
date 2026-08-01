-- =====================================================================
-- LEVLA — 0034 ledaren kan ta bort poäng
--
-- En ledare kunde dela ut poäng (mark_present) men aldrig ta tillbaka dem.
-- Blev det fel — dubbel närvaro, någon som markerades av misstag, en
-- överenskommelse som bröts — fanns ingen väg tillbaka annat än i
-- SQL-editorn. Nu finns remove_points.
--
-- TVÅ SAKER ÄNDRAS INTE, MED FLIT:
--
--   XP rörs inte. Poäng är valuta, XP är vad man har gjort. Ett avdrag är en
--   rättelse av kassan, inte en omskrivning av historien — och topplistan
--   rankar på XP. Se docs/ARKITEKTUR.md.
--
--   Märken sitter kvar. Märkena räknar livstidsintjänade poäng (delta > 0),
--   så ett avdrag låser inte upp något bakåt. Det var redan avsiktligt i
--   0031 och gäller fortfarande.
--
-- Saldot självt sköts av triggern on_ledger_insert från 0002: en rad i
-- points_ledger uppdaterar membership.points. Den här funktionen skriver
-- alltså bara raden — med negativt delta.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Vem gjorde justeringen?
--
-- Huvudboken har hittills bara vetat VAD som hände, inte vem som tryckte.
-- För automatiska rader (incheckning, veckomål, uttag) räcker reason, men
-- ett manuellt avdrag måste gå att spåra till en person.
-- ---------------------------------------------------------------------
alter table public.points_ledger
  add column if not exists created_by uuid references auth.users(id) on delete set null;

comment on column public.points_ledger.created_by is
  'Sätts när en ledare justerar poäng för hand. Null för automatiska rader.';

-- ---------------------------------------------------------------------
-- 2. remove_points — ledaren drar av poäng från en ungdom
-- ---------------------------------------------------------------------
create or replace function public.remove_points(
  p_forening uuid, p_user uuid, p_amount int, p_reason text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  saldo  int;
  namn   text;
  skal   text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not private.has_forening_role(p_forening, 'ledare') then
    raise exception 'Endast ledare kan justera poäng';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Ange hur många poäng som ska tas bort';
  end if;

  -- FOR UPDATE: två ledare som drar av samtidigt ska inte båda läsa samma
  -- saldo och tillsammans dra det under noll.
  select m.points into saldo from public.membership m
   where m.user_id = p_user and m.forening_id = p_forening and m.role = 'ungdom'
   for update;
  if saldo is null then raise exception 'Ungdomen finns inte i föreningen'; end if;

  -- Hellre ett tydligt nej än ett tyst minussaldo: butiken och märkena utgår
  -- båda från att saldot aldrig är negativt.
  if p_amount > saldo then
    raise exception 'Går inte — saldot är % poäng', saldo;
  end if;

  insert into public.points_ledger (forening_id, user_id, delta, reason, created_by)
  values (p_forening, p_user, -p_amount,
          'avdrag:' || coalesce(skal, 'ledare'), auth.uid());

  select coalesce(nullif(pr.display_name, ''), 'Medlem') into namn
    from public.profiles pr where pr.id = p_user;

  -- Ungdomen ska få veta det direkt, inte upptäcka det i butiken. Raden
  -- utlöser push via triggern från 0012.
  insert into public.notification (forening_id, user_id, icon, tint, title, body)
  values (p_forening, p_user, 'coin', '#fee2e2',
          '−' || p_amount || ' poäng',
          case when skal is null
               then 'En ledare har justerat dina poäng.'
               else 'En ledare har justerat dina poäng: ' || skal end);

  return jsonb_build_object('removed', p_amount, 'balance', saldo - p_amount, 'name', namn);
end $$;
grant execute on function public.remove_points(uuid, uuid, int, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. ledare_youth v2 — visa saldot
--
-- Ledaren måste se hur mycket som finns innan hen drar av, annars blir
-- avdraget en gissning som servern nekar. DROP först: RETURNS TABLE ändras.
-- ---------------------------------------------------------------------
drop function if exists public.ledare_youth(uuid, uuid);
create or replace function public.ledare_youth(p_forening uuid, p_activity uuid default null)
returns table (
  user_id uuid, name text, avatar_color text, visits int,
  present_today boolean, points int
)
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
         ),
         m.points
    from public.membership m
    join public.profiles p on p.id = m.user_id
   where m.forening_id = p_forening and m.role = 'ungdom'
     and private.has_forening_role(p_forening, 'ledare')
   order by p.display_name nulls last;
$$;
grant execute on function public.ledare_youth(uuid, uuid) to authenticated;

-- =====================================================================
-- LEVLA — 0017 antal per belöning
-- En ledare bestämmer hur många som kan få en belöning: "15 biobiljetter".
-- stock = null betyder obegränsat (som tidigare). Varje medlem kan
-- fortfarande bara ta ut en given belöning en gång — stock begränsar hur
-- många personer totalt som hinner före.
-- =====================================================================

alter table public.reward add column if not exists stock int;
alter table public.reward drop constraint if exists reward_stock_check;
alter table public.reward add constraint reward_stock_check check (stock is null or stock >= 0);

-- ---------------------------------------------------------------------
-- youth_shop — belöningarna plus hur många som är tagna.
--
-- Antalet kan inte räknas i klienten: RLS på redemption låter en ungdom
-- bara se sina EGNA uttag, så en direktfråga skulle alltid rapportera
-- "0 tagna" för alla andras. Därför en SECURITY DEFINER-funktion.
-- ---------------------------------------------------------------------
create or replace function public.youth_shop(p_forening uuid)
returns table (
  id    uuid,
  title text,
  tag   text,
  icon  text,
  tint  text,
  cost  int,
  stock int,
  taken int,
  mine  boolean
)
language sql security definer set search_path = '' stable as $$
  select r.id, r.title, r.tag, r.icon, r.tint, r.cost, r.stock,
         (select count(*)::int from public.redemption d where d.reward_id = r.id) as taken,
         exists (
           select 1 from public.redemption d
            where d.reward_id = r.id and d.user_id = auth.uid()
         ) as mine
    from public.reward r
   where r.forening_id = p_forening
     and r.active = true
     and exists (
       select 1 from public.membership m
        where m.user_id = auth.uid() and m.forening_id = p_forening
     )
   order by r.cost;
$$;
grant execute on function public.youth_shop(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- redeem_reward v2 — samma som förut, plus lagerkontroll.
--
-- Raden låses med FOR UPDATE innan uttagen räknas. Utan låset kan två
-- samtidiga uttag båda läsa "14 tagna av 15" och båda gå igenom, så att
-- 16 ungdomar får en belöning som fanns i 15 exemplar.
-- ---------------------------------------------------------------------
create or replace function public.redeem_reward(p_reward_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r     public.reward;
  m     public.membership;
  taken int;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;

  select * into r from public.reward where id = p_reward_id and active = true for update;
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

  if r.stock is not null then
    select count(*)::int into taken from public.redemption where reward_id = r.id;
    if taken >= r.stock then raise exception 'Slut — alla % är uttagna', r.stock; end if;
  end if;

  if m.points < r.cost then raise exception 'Inte tillräckligt med poäng'; end if;

  insert into public.redemption (forening_id, user_id, reward_id, cost)
  values (r.forening_id, auth.uid(), r.id, r.cost);

  insert into public.points_ledger (forening_id, user_id, delta, reason)
  values (r.forening_id, auth.uid(), -r.cost, 'redeem:' || r.id::text);

  return jsonb_build_object('cost', r.cost, 'title', r.title, 'points_left', m.points - r.cost);
end $$;
grant execute on function public.redeem_reward(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- ledare_rewards — ledarens vy: belöningarna med uttagsräknare.
-- Samma RLS-skäl som ovan: ledaren ser visserligen alla uttag, men en
-- egen funktion håller räkningen på ett ställe.
-- ---------------------------------------------------------------------
create or replace function public.ledare_rewards(p_forening uuid)
returns table (
  id     uuid,
  title  text,
  tag    text,
  icon   text,
  tint   text,
  cost   int,
  stock  int,
  taken  int,
  active boolean
)
language sql security definer set search_path = '' stable as $$
  select r.id, r.title, r.tag, r.icon, r.tint, r.cost, r.stock,
         (select count(*)::int from public.redemption d where d.reward_id = r.id) as taken,
         r.active
    from public.reward r
   where r.forening_id = p_forening
     and private.has_forening_role(p_forening, 'ledare')
   order by r.active desc, r.cost;
$$;
grant execute on function public.ledare_rewards(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- set_reward_stock — ledaren ändrar antalet i efterhand.
-- ---------------------------------------------------------------------
create or replace function public.set_reward_stock(p_reward uuid, p_stock int)
returns void language plpgsql security definer set search_path = '' as $$
declare
  fid uuid;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  select forening_id into fid from public.reward where id = p_reward;
  if not found then raise exception 'Belöningen finns inte'; end if;
  if not private.has_forening_role(fid, 'ledare') then
    raise exception 'Endast ledare kan ändra antalet';
  end if;
  if p_stock is not null and p_stock < 0 then raise exception 'Antalet kan inte vara negativt'; end if;
  update public.reward set stock = p_stock where id = p_reward;
end $$;
grant execute on function public.set_reward_stock(uuid, int) to authenticated;

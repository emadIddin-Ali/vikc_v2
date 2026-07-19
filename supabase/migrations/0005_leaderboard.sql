-- =====================================================================
-- LEVLA — 0005 leaderboard (per förening)
-- Youths can't read each other's points_ledger (RLS), so ranking is computed
-- by a SECURITY DEFINER function that only exposes rank + name + points.
-- Demo competitors make the board look alive with a single test account.
-- =====================================================================

-- Static demo competitors (per förening). Read only via leaderboard().
create table if not exists public.leaderboard_demo (
  id           uuid primary key default gen_random_uuid(),
  forening_id  uuid not null references public.forening(id) on delete cascade,
  name         text not null,
  avatar_color text not null default '#6c4cf1',
  points       integer not null default 0
);
alter table public.leaderboard_demo enable row level security;
-- (no client policies: only the SECURITY DEFINER leaderboard() reads this table)

-- Ranked leaderboard for a förening. Gated to members/ledare/kommun of that förening.
create or replace function public.leaderboard(p_forening uuid)
returns table (
  rank int,
  user_id uuid,
  name text,
  points int,
  avatar_color text,
  is_me boolean
) language sql security definer set search_path = '' stable as $$
  with entries as (
    select m.user_id,
           coalesce(nullif(p.display_name, ''), 'Medlem') as name,
           m.points,
           coalesce(p.avatar_color, '#6c4cf1') as avatar_color
      from public.membership m
      join public.profiles p on p.id = m.user_id
     where m.forening_id = p_forening and m.role = 'ungdom'
    union all
    select null::uuid, d.name, d.points, d.avatar_color
      from public.leaderboard_demo d
     where d.forening_id = p_forening
  ), ranked as (
    select e.*, row_number() over (order by e.points desc, e.name asc) as rnk
      from entries e
  )
  select r.rnk::int, r.user_id, r.name, r.points::int, r.avatar_color,
         (r.user_id = auth.uid()) as is_me
    from ranked r
   where private.can_access_forening(p_forening)
   order by r.rnk
   limit 30;
$$;
grant execute on function public.leaderboard(uuid) to authenticated;

-- Seed demo competitors for Fritidsgården Centrum (matches the prototype board).
insert into public.leaderboard_demo (forening_id, name, avatar_color, points)
select f.id, v.name, v.color, v.pts
  from public.forening f,
       (values
         ('Maja L.',  '#ffd23f', 2140),
         ('Noah P.',  '#a24cf1', 1980),
         ('Liam S.',  '#22c55e', 1720),
         ('Alva K.',  '#ff7a4d', 1100),
         ('Hugo R.',  '#0ea5e9',  980),
         ('Selma T.', '#ec4899',  840)
       ) as v(name, color, pts)
 where f.join_code = 'CENTRUM'
   and not exists (select 1 from public.leaderboard_demo d where d.forening_id = f.id);

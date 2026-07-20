-- =====================================================================
-- LEVLA — 0014 badges (märken)
-- Global badge catalog. Whether a member has unlocked a badge is COMPUTED
-- from their membership stats / check-ins (no per-user unlock table needed).
-- =====================================================================

create table if not exists public.badge (
  id        uuid primary key default gen_random_uuid(),
  code      text unique not null,
  name      text not null,
  icon      text not null,
  tint      text not null,
  color     text not null,
  criterion text not null,          -- 'streak' | 'visits' | 'level' | 'points' | 'theme'
  threshold int,                    -- for numeric criteria
  theme     text,                   -- for the 'theme' criterion (activity theme id)
  sort      int not null default 0
);
alter table public.badge enable row level security;
-- (no client policy: only the SECURITY DEFINER youth_badges() reads it)

insert into public.badge (code, name, icon, tint, color, criterion, threshold, theme, sort) values
  ('streak5',  '5 i rad',    'fire',    '#ffe9d6', '#ff7a4d', 'streak', 5,   null,    1),
  ('visits10', 'Trogen',     'calendar','#ede7ff', '#6c4cf1', 'visits', 10,  null,    2),
  ('sport',    'Sport',      'soccer',  '#e0f2fe', '#0ea5e9', 'theme',  null, 'sport', 3),
  ('musik',    'Kreatör',    'palette', '#ede7ff', '#6c4cf1', 'theme',  null, 'musik', 4),
  ('plugg',    'Pluggis',    'book',    '#fef9c3', '#caa500', 'theme',  null, 'plugg', 5),
  ('points500','Poängjägare','coin',    '#fff3e0', '#c07a1e', 'points', 500, null,    6),
  ('level5',   'Nivåryttare','trophy',  '#fff3e0', '#ff9500', 'level',  5,   null,    7),
  ('level10',  'Legend',     'diamond', '#e0f2fe', '#0ea5e9', 'level',  10,  null,    8)
on conflict (code) do nothing;

-- Return every badge + whether the current user has unlocked it in this förening.
create or replace function public.youth_badges(p_forening uuid)
returns table (code text, name text, icon text, tint text, color text, unlocked boolean, sort int)
language sql security definer set search_path = '' stable as $$
  with m as (
    select * from public.membership where user_id = auth.uid() and forening_id = p_forening
  )
  select b.code, b.name, b.icon, b.tint, b.color,
         coalesce(case b.criterion
           when 'streak' then (select streak from m) >= b.threshold
           when 'visits' then (select visits from m) >= b.threshold
           when 'level'  then (select level  from m) >= b.threshold
           when 'points' then (select points from m) >= b.threshold
           when 'theme'  then exists (
             select 1 from public.checkin c
             join public.activity a on a.id = c.activity_id
             where c.user_id = auth.uid() and c.forening_id = p_forening and a.theme = b.theme
           )
           else false
         end, false) as unlocked,
         b.sort
    from public.badge b
   order by b.sort;
$$;
grant execute on function public.youth_badges(uuid) to authenticated;

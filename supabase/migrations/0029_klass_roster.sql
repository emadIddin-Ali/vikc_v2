-- =====================================================================
-- LEVLA — 0029 klasslistan som en lista att bocka i
--
-- forening_elever() svarade bara "finns i någon av mina klasser", vilket
-- räckte för att LÄGGA TILL men inte för att TA BORT — läraren fick gräva
-- sig in i elevens historik för att hitta bort-knappen. Nu returneras
-- klass_elev-raden för den klass man håller på med, så samma lista kan både
-- lägga till och ta bort och läraren ser hela klassuppsättningen på en gång.
--
-- Kräver 0028. Idempotent.
-- =====================================================================

drop function if exists public.forening_elever(uuid, text);

create or replace function public.forening_elever(
  p_forening uuid, p_query text default null, p_klass uuid default null
)
returns table (kind text, user_id uuid, child_id uuid, name text, avatar_color text,
               birth_year int, i_min_klass boolean, klass_elev_id uuid)
language sql security definer set search_path = '' stable as $$
  with q as (select nullif(trim(coalesce(p_query, '')), '') as term)
  select 'medlem'::text, m.user_id, null::uuid,
         coalesce(nullif(p.display_name, ''), 'Medlem'),
         coalesce(p.avatar_color, '#6c4cf1'),
         null::int,
         exists (select 1 from public.klass_elev e
                   join public.klass k on k.id = e.klass_id
                  where e.student_user_id = m.user_id and k.larare_user_id = auth.uid() and not k.archived),
         (select e.id from public.klass_elev e
           where e.klass_id = p_klass and e.student_user_id = m.user_id)
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
                  where e.child_id = c.id and k.larare_user_id = auth.uid() and not k.archived),
         (select e.id from public.klass_elev e
           where e.klass_id = p_klass and e.child_id = c.id)
    from public.child c
   cross join q
   where c.forening_id = p_forening
     and (private.is_larare(p_forening) or private.has_forening_role(p_forening, 'ledare'))
     and (q.term is null or c.display_name ilike '%' || q.term || '%')
   order by 4
   limit 200;
$$;
grant execute on function public.forening_elever(uuid, text, uuid) to authenticated;

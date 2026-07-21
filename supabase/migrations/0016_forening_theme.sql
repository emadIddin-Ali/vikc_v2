-- =====================================================================
-- LEVLA — 0016 tema per förening
-- En ledare väljer föreningens tema. Temat styr appens gradient för alla
-- medlemmar i just den föreningen — en ledare med flera föreningar sätter
-- det per förening, inte för hela appen.
--
-- Namnen valideras här så att klienten aldrig kan skriva in ett tema som
-- appen inte känner igen och rendera en trasig gradient.
-- =====================================================================

alter table public.forening
  add column if not exists theme text not null default 'lila';

alter table public.forening drop constraint if exists forening_theme_check;
alter table public.forening
  add constraint forening_theme_check check (theme in ('lila', 'soluppgang', 'hav'));

-- forening_write är begränsad till kommun-admins, så ledare byter tema via
-- den här funktionen (samma mönster som set_forening_location).
create or replace function public.set_forening_theme(
  p_forening uuid,
  p_theme    text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not private.has_forening_role(p_forening, 'ledare') then
    raise exception 'Endast ledare kan ändra föreningens tema';
  end if;
  if p_theme not in ('lila', 'soluppgang', 'hav') then
    raise exception 'Okänt tema: %', p_theme;
  end if;
  update public.forening set theme = p_theme where id = p_forening;
end $$;
grant execute on function public.set_forening_theme(uuid, text) to authenticated;

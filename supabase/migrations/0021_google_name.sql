-- =====================================================================
-- LEVLA — 0021 hämta namn från Google-konton
--
-- Vid e-post/lösenord ligger namnet i display_name. Google skickar det
-- istället som full_name / name. Utan detta får Google-användare ett tomt
-- profilnamn och appen faller tillbaka på e-postprefixet. Vi plockar det
-- första ifyllda av dem när profilen skapas.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_color)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      ''
    ),
    '#6c4cf1'
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- =====================================================================
-- LEVLA — 0020 föreningsinfo + logotyp
--
-- En ledare kan lägga in föreningens publika info (beskrivning, adress,
-- kontakt, öppettider) och ladda upp en logotyp. Infon är delad: alla
-- ledare i föreningen ser och redigerar samma sak, och medlemmarna ser
-- logotypen i ungdomsappen.
-- =====================================================================

alter table public.forening
  add column if not exists description   text,
  add column if not exists address       text,
  add column if not exists phone         text,
  add column if not exists email         text,
  add column if not exists opening_hours text,
  add column if not exists logo_url      text;

-- ---------- Storage bucket för logotyper ----------
insert into storage.buckets (id, name, public)
values ('forening-logos', 'forening-logos', true)
on conflict (id) do nothing;

-- Alla får läsa (logotypen visas för ungdomarna).
drop policy if exists forening_logos_read on storage.objects;
create policy forening_logos_read on storage.objects for select to public
  using (bucket_id = 'forening-logos');

-- Bara en ledare i föreningen får ladda upp/byta/ta bort dess logotyp. Filens
-- sökväg är "<forening-id>/...", så första mappsegmentet är föreningens id.
drop policy if exists forening_logos_write on storage.objects;
create policy forening_logos_write on storage.objects for all to authenticated
  using (
    bucket_id = 'forening-logos'
    and private.has_forening_role((storage.foldername(name))[1]::uuid, 'ledare')
  )
  with check (
    bucket_id = 'forening-logos'
    and private.has_forening_role((storage.foldername(name))[1]::uuid, 'ledare')
  );

-- ---------- RPC: uppdatera föreningens info (endast ledare) ----------
-- forening_write-policyn tillåter bara kommun-admin att skriva i forening, så
-- ledaren når fälten via den här SECURITY DEFINER-funktionen istället. Ett tomt
-- fält rensar värdet; ett tomt namn behåller det befintliga.
create or replace function public.update_forening_info(
  p_forening uuid,
  p_name text default null,
  p_description text default null,
  p_address text default null,
  p_phone text default null,
  p_email text default null,
  p_opening_hours text default null,
  p_logo_url text default null
) returns public.forening language plpgsql security definer set search_path = '' as $$
declare f public.forening;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;
  if not private.has_forening_role(p_forening, 'ledare') then
    raise exception 'Endast ledare kan ändra föreningens info';
  end if;

  update public.forening set
    name          = coalesce(nullif(trim(coalesce(p_name, '')), ''), name),
    description   = nullif(trim(coalesce(p_description, '')), ''),
    address       = nullif(trim(coalesce(p_address, '')), ''),
    phone         = nullif(trim(coalesce(p_phone, '')), ''),
    email         = nullif(trim(coalesce(p_email, '')), ''),
    opening_hours = nullif(trim(coalesce(p_opening_hours, '')), ''),
    logo_url      = nullif(trim(coalesce(p_logo_url, '')), '')
  where id = p_forening
  returning * into f;

  return f;
end $$;
grant execute on function public.update_forening_info(uuid, text, text, text, text, text, text, text) to authenticated;

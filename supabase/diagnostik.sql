-- =====================================================================
-- LEVLA — vilka migrationer är körda i den här databasen?
--
-- Klistra in i Supabase SQL Editor och kör. Ingenting ändras — frågan läser
-- bara schemat och letar efter spår av varje migration.
--
-- Migrationerna körs för hand, så det finns ingen logg som säger vad som är
-- gjort. Den här frågan är loggen: den frågar databasen i stället för att
-- lita på minnet.
-- =====================================================================

with f as (
  select p.proname, p.pronargs, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
),
k as (
  select table_name, column_name
    from information_schema.columns
   where table_schema = 'public'
)
select migration, case when klar then '✅ körd' else '❌ saknas' end as status
from (values
  ('0016 tema per förening',
     exists (select 1 from k where table_name = 'forening' and column_name = 'theme')),
  ('0017 antal per belöning',
     exists (select 1 from k where table_name = 'reward' and column_name = 'stock')),
  ('0018 uppdrag v2',
     exists (select 1 from k where table_name = 'mission' and column_name = 'kind')),
  ('0019 utcheckning',
     exists (select 1 from k where table_name = 'checkin' and column_name = 'pending')),
  ('0020 föreningsinfo',
     exists (select 1 from k where table_name = 'forening' and column_name = 'logo_url')),
  ('0021 Google-namn',
     exists (select 1 from f where proname = 'handle_new_user' and def like '%full_name%')),
  ('0022 förälder-roll (enum)',
     exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
              where t.typname = 'app_role' and e.enumlabel = 'foralder')),
  ('0023 föräldrar och barn',
     to_regclass('public.child') is not null),
  ('0024 säkerhetshärdning',
     exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'checkin_photos_read')),
  ('0025 aktiviteter går ut',
     exists (select 1 from f where proname = 'check_in' and def like '%date_trunc(''day'', a.starts_at)%')),
  ('0026 personnummer',
     exists (select 1 from k where table_name = 'forening' and column_name = 'require_personnummer')),
  ('0027 lärarroll (enum)',
     exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
              where t.typname = 'app_role' and e.enumlabel = 'larare')),
  ('0028 klasser och stjärnor',
     to_regclass('public.klass') is not null),
  ('0029 klasslistan att bocka i',
     exists (select 1 from f where proname = 'forening_elever' and pronargs = 3)),
  ('0030 marknaden',
     to_regclass('public.marknad') is not null),
  ('0031 XP-ekonomin',
     to_regclass('public.xp_ledger') is not null),
  ('0032 härdning v2',
     exists (select 1 from f where proname = 'rotate_join_code'))
) t(migration, klar)
order by migration;

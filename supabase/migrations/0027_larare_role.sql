-- =====================================================================
-- LEVLA — 0027 lärarroll (enum-värde)
--
-- MÅSTE vara en egen migration, precis som 0022 (föräldrarollen): Postgres
-- tillåter inte att `alter type ... add value` körs i samma transaktion som
-- något som sedan ANVÄNDER värdet. Kör den här filen för sig, sedan 0028.
-- =====================================================================

alter type public.app_role add value if not exists 'larare';

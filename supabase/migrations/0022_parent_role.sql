-- =====================================================================
-- LEVLA — 0022 förälder-roll (enum-värde)
--
-- MÅSTE vara en egen migration: Postgres tillåter inte att `alter type ...
-- add value` körs i samma transaktion som något som sedan ANVÄNDER värdet.
-- Kör den här filen för sig, sedan 0023.
-- =====================================================================

alter type public.app_role add value if not exists 'foralder';

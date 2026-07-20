-- =====================================================================
-- LEVLA — 0012 push notifications
-- Stores each device's Expo push token and, whenever a notification row is
-- created (e.g. a leader publishes an activity), fires a real push via the
-- Expo push service using pg_net (async HTTP from Postgres).
--
-- NOTE: real push requires a development build on the client (Expo Go SDK 54
-- does not support remote push). The pipeline is inert until then.
-- =====================================================================

create extension if not exists pg_net;

create table if not exists public.push_token (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  token      text not null,
  updated_at timestamptz not null default now()
);
alter table public.push_token enable row level security;

drop policy if exists push_token_own on public.push_token;
create policy push_token_own on public.push_token for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.push_token to authenticated;

-- Send a push to the notification's owner (if they have a registered token).
create or replace function public.send_push_on_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare tok text;
begin
  select token into tok from public.push_token where user_id = new.user_id;
  if tok is not null and tok <> '' then
    perform net.http_post(
      url     := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := jsonb_build_object(
        'to', tok,
        'title', new.title,
        'body', coalesce(new.body, ''),
        'sound', 'default',
        'channelId', 'default'
      )
    );
  end if;
  return new;
end $$;

drop trigger if exists on_notification_push on public.notification;
create trigger on_notification_push after insert on public.notification
  for each row execute function public.send_push_on_notification();

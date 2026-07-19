-- =====================================================================
-- LEVLA — 0002 helper functions, triggers, RLS policies, RPCs
-- Enforcement is SERVER-SIDE. forening_id scoping is derived from the
-- authenticated session (auth.uid()) — never trusted from the client.
-- =====================================================================

-- ---------- PRIVILEGES (RLS still filters every row) ----------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- anon (pre-login) gets nothing on domain tables; policies below are all `to authenticated`.

-- ---------- SECURITY DEFINER HELPERS ----------
-- Run as owner (postgres) so they bypass RLS on membership/forening and
-- therefore never cause recursive policy evaluation.
create schema if not exists private;

-- Can the current user access this förening? (member of it OR kommun-admin over it)
create or replace function private.can_access_forening(fid uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
           select 1 from public.membership m
           where m.user_id = auth.uid() and m.forening_id = fid
         )
      or exists (
           select 1 from public.forening f
           join public.kommun_admin ka on ka.kommun_id = f.kommun_id
           where f.id = fid and ka.user_id = auth.uid()
         );
$$;

-- Does the current user hold a given role in the förening? (kommun-admin acts as ledare)
create or replace function private.has_forening_role(fid uuid, need public.app_role)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
           select 1 from public.membership m
           where m.user_id = auth.uid() and m.forening_id = fid and m.role = need
         )
      or (need = 'ledare' and exists (
           select 1 from public.forening f
           join public.kommun_admin ka on ka.kommun_id = f.kommun_id
           where f.id = fid and ka.user_id = auth.uid()
         ));
$$;

-- Do I share at least one förening with another user? (needed to see co-members' names)
create or replace function private.shares_forening(other_user uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.membership a
    join public.membership b on a.forening_id = b.forening_id
    where a.user_id = auth.uid() and b.user_id = other_user
  );
$$;

-- Am I a kommun-admin of this kommun?
create or replace function private.is_kommun_admin(kid uuid)
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (
    select 1 from public.kommun_admin ka
    where ka.user_id = auth.uid() and ka.kommun_id = kid
  );
$$;

grant usage on schema private to anon, authenticated;
grant execute on all functions in schema private to anon, authenticated;

-- ---------- TRIGGERS ----------

-- Auto-create a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_color)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name',''), '#6c4cf1')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep membership.points as a cache of the points_ledger.
create or replace function public.apply_ledger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.membership
     set points = points + new.delta
   where user_id = new.user_id and forening_id = new.forening_id;
  return new;
end $$;

drop trigger if exists on_ledger_insert on public.points_ledger;
create trigger on_ledger_insert
  after insert on public.points_ledger
  for each row execute function public.apply_ledger();

-- ---------- ENABLE RLS ----------
alter table public.kommun            enable row level security;
alter table public.forening          enable row level security;
alter table public.profiles          enable row level security;
alter table public.kommun_admin      enable row level security;
alter table public.membership        enable row level security;
alter table public.activity          enable row level security;
alter table public.reward            enable row level security;
alter table public.checkin           enable row level security;
alter table public.redemption        enable row level security;
alter table public.points_ledger     enable row level security;
alter table public.notification      enable row level security;
alter table public.mission           enable row level security;
alter table public.mission_progress  enable row level security;

-- ---------- POLICIES ----------

-- KOMMUN: visible to its admins and to anyone who can access a förening under it.
drop policy if exists kommun_select on public.kommun;
create policy kommun_select on public.kommun for select to authenticated
  using (
    private.is_kommun_admin(id)
    or exists (select 1 from public.forening f
               where f.kommun_id = kommun.id and private.can_access_forening(f.id))
  );

-- FORENING: readable by members + kommun-admins; writable by kommun-admins.
drop policy if exists forening_select on public.forening;
create policy forening_select on public.forening for select to authenticated
  using (private.can_access_forening(id));

drop policy if exists forening_write on public.forening;
create policy forening_write on public.forening for all to authenticated
  using (private.is_kommun_admin(kommun_id))
  with check (private.is_kommun_admin(kommun_id));

-- PROFILES: own profile + co-members (for leaderboard/attendance display).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or private.shares_forening(id));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- KOMMUN_ADMIN: a user can see their own admin rows.
drop policy if exists kommun_admin_select on public.kommun_admin;
create policy kommun_admin_select on public.kommun_admin for select to authenticated
  using (user_id = auth.uid());

-- MEMBERSHIP: readable by anyone who can access the förening (self + co-members + ledare/kommun).
-- No client insert/update: joining happens via join_forening_by_code(); stats are server-owned.
drop policy if exists membership_select on public.membership;
create policy membership_select on public.membership for select to authenticated
  using (private.can_access_forening(forening_id));

-- ACTIVITY
drop policy if exists activity_select on public.activity;
create policy activity_select on public.activity for select to authenticated
  using (private.can_access_forening(forening_id));
drop policy if exists activity_write on public.activity;
create policy activity_write on public.activity for all to authenticated
  using (private.has_forening_role(forening_id,'ledare'))
  with check (private.has_forening_role(forening_id,'ledare'));

-- REWARD
drop policy if exists reward_select on public.reward;
create policy reward_select on public.reward for select to authenticated
  using (private.can_access_forening(forening_id));
drop policy if exists reward_write on public.reward;
create policy reward_write on public.reward for all to authenticated
  using (private.has_forening_role(forening_id,'ledare'))
  with check (private.has_forening_role(forening_id,'ledare'));

-- CHECKIN: youth see their own; ledare see all in the förening. Inserts are RPC-only.
drop policy if exists checkin_select on public.checkin;
create policy checkin_select on public.checkin for select to authenticated
  using (user_id = auth.uid() or private.has_forening_role(forening_id,'ledare'));

-- REDEMPTION
drop policy if exists redemption_select on public.redemption;
create policy redemption_select on public.redemption for select to authenticated
  using (user_id = auth.uid() or private.has_forening_role(forening_id,'ledare'));

-- POINTS_LEDGER
drop policy if exists ledger_select on public.points_ledger;
create policy ledger_select on public.points_ledger for select to authenticated
  using (user_id = auth.uid() or private.has_forening_role(forening_id,'ledare'));

-- NOTIFICATION: own only; may mark own as read.
drop policy if exists notification_select on public.notification;
create policy notification_select on public.notification for select to authenticated
  using (user_id = auth.uid());
drop policy if exists notification_update on public.notification;
create policy notification_update on public.notification for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- MISSION
drop policy if exists mission_select on public.mission;
create policy mission_select on public.mission for select to authenticated
  using (private.can_access_forening(forening_id));
drop policy if exists mission_write on public.mission;
create policy mission_write on public.mission for all to authenticated
  using (private.has_forening_role(forening_id,'ledare'))
  with check (private.has_forening_role(forening_id,'ledare'));

-- MISSION_PROGRESS
drop policy if exists mission_progress_select on public.mission_progress;
create policy mission_progress_select on public.mission_progress for select to authenticated
  using (user_id = auth.uid() or private.has_forening_role(forening_id,'ledare'));

-- ---------- RPCs ----------

-- Join a förening using its share code. Creates an 'ungdom' membership.
-- SECURITY DEFINER so it can insert into membership (which has no client insert policy).
create or replace function public.join_forening_by_code(p_code text)
returns public.membership language plpgsql security definer set search_path = '' as $$
declare
  f public.forening;
  m public.membership;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;

  select * into f from public.forening where join_code = upper(trim(p_code));
  if not found then raise exception 'Ogiltig föreningskod'; end if;

  insert into public.membership (user_id, forening_id, role)
  values (auth.uid(), f.id, 'ungdom')
  on conflict (user_id, forening_id) do update set forening_id = excluded.forening_id  -- no-op; keeps existing role
  returning * into m;

  return m;
end $$;
grant execute on function public.join_forening_by_code(text) to authenticated;

-- DEV ONLY: populate the current user's data in a förening so the home view is lively.
-- Safe to run manually from the SQL editor after you've joined the förening.
create or replace function public.dev_seed_me(p_forening uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare mid uuid;
begin
  if auth.uid() is null then raise exception 'Ej inloggad'; end if;

  update public.membership
     set points = 1240, xp = 720, level = 7, streak = 5, visits = 34
   where user_id = auth.uid() and forening_id = p_forening
   returning id into mid;
  if mid is null then raise exception 'Du är inte medlem i den föreningen (kör join_forening_by_code först)'; end if;

  insert into public.notification (forening_id, user_id, icon, tint, title, body, read) values
    (p_forening, auth.uid(), 'target','#ede7ff','Nytt uppdrag: Kvällsfik','Kom förbi ikväll och få +50 XP.', false),
    (p_forening, auth.uid(), 'trophy','#fff3e0','Du klättrade till plats 4!','340 poäng till en pallplats.', false),
    (p_forening, auth.uid(), 'gift','#dcfce7','Belöning inom räckhåll','Snart har du nog för en biobiljett.', true);

  insert into public.checkin (forening_id, user_id, title, awarded_points, awarded_xp, created_at) values
    (p_forening, auth.uid(), 'Kvällsfik – Fritidsgården', 50, 50, now() - interval '20 hours'),
    (p_forening, auth.uid(), 'Skaparkväll: musik',        120,120, now() - interval '2 days'),
    (p_forening, auth.uid(), 'Läxhjälp',                    40, 40, now() - interval '4 days');

  insert into public.mission_progress (mission_id, forening_id, user_id, progress, done)
  select mi.id, mi.forening_id, auth.uid(), least(mi.goal, greatest(0, mi.goal - 1)), false
  from public.mission mi where mi.forening_id = p_forening
  on conflict (mission_id, user_id) do nothing;
end $$;
grant execute on function public.dev_seed_me(uuid) to authenticated;

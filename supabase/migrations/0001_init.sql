-- =====================================================================
-- LEVLA — 0001 init schema
-- Multi-tenant: "forening" (association/venue) is the tenant.
-- EVERY domain row carries forening_id and is isolated per tenant via RLS.
-- Roles: ungdom | ledare (per membership) + kommun-admin (municipal umbrella).
-- =====================================================================

-- ---------- ENUMS ----------
do $$ begin
  create type public.app_role as enum ('ungdom','ledare');
exception when duplicate_object then null; end $$;

-- ---------- UMBRELLA / TENANT TABLES ----------

-- Municipality (umbrella that owns many föreningar). Kommun-admins are scoped to one.
create table if not exists public.kommun (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- Förening = the tenant. All data is scoped to a förening.
create table if not exists public.forening (
  id                uuid primary key default gen_random_uuid(),
  kommun_id         uuid not null references public.kommun(id) on delete cascade,
  name              text not null,
  color             text not null default '#6c4cf1',
  join_code         text unique,                 -- share/invite code youths use to join
  lat               double precision,            -- venue coords for the check-in geofence
  lng               double precision,
  geofence_radius_m integer not null default 120,
  created_at        timestamptz not null default now()
);

-- 1:1 with auth.users. Global identity (name/avatar) — not tenant data.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default '',
  avatar_color  text not null default '#6c4cf1',
  created_at    timestamptz not null default now()
);

-- Municipal superadmin, scoped to a kommun (sees ALL föreningar in that kommun).
create table if not exists public.kommun_admin (
  user_id     uuid not null references auth.users(id) on delete cascade,
  kommun_id   uuid not null references public.kommun(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, kommun_id)
);

-- A user's role within a förening + their per-förening gamification state.
-- Progress is per (user, förening) so it can NEVER bleed across tenants.
create table if not exists public.membership (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  forening_id uuid not null references public.forening(id) on delete cascade,
  role        public.app_role not null default 'ungdom',
  points      integer not null default 0,
  xp          integer not null default 0,
  level       integer not null default 1,
  streak      integer not null default 0,
  visits      integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, forening_id)
);

-- ---------- DOMAIN TABLES (every row carries forening_id) ----------

create table if not exists public.activity (
  id           uuid primary key default gen_random_uuid(),
  forening_id  uuid not null references public.forening(id) on delete cascade,
  title        text not null,
  when_text    text,
  points       integer not null default 30,
  place_label  text,
  theme        text not null default 'fika',     -- fika|sport|musik|gaming|fest|plugg
  lat          double precision,
  lng          double precision,
  qr_token     text not null default replace(gen_random_uuid()::text,'-',''),
  active       boolean not null default true,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.reward (
  id           uuid primary key default gen_random_uuid(),
  forening_id  uuid not null references public.forening(id) on delete cascade,
  title        text not null,
  tag          text,
  icon         text not null default 'gift',
  tint         text not null default '#f0ebff',
  cost         integer not null default 100,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create table if not exists public.checkin (
  id             uuid primary key default gen_random_uuid(),
  forening_id    uuid not null references public.forening(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  activity_id    uuid references public.activity(id) on delete set null,
  title          text,                            -- denormalized for history rows
  awarded_points integer not null default 0,
  awarded_xp     integer not null default 0,
  created_at     timestamptz not null default now()
);

create table if not exists public.redemption (
  id           uuid primary key default gen_random_uuid(),
  forening_id  uuid not null references public.forening(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  reward_id    uuid references public.reward(id) on delete set null,
  cost         integer not null default 0,
  created_at   timestamptz not null default now()
);

-- Source of truth for points. membership.points is a cache maintained by trigger.
create table if not exists public.points_ledger (
  id           uuid primary key default gen_random_uuid(),
  forening_id  uuid not null references public.forening(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  delta        integer not null,
  reason       text,
  created_at   timestamptz not null default now()
);

create table if not exists public.notification (
  id           uuid primary key default gen_random_uuid(),
  forening_id  uuid not null references public.forening(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  icon         text not null default 'target',
  tint         text not null default '#ede7ff',
  title        text not null,
  body         text,
  read         boolean not null default false,
  created_at   timestamptz not null default now()
);

-- Mission templates per förening.
create table if not exists public.mission (
  id           uuid primary key default gen_random_uuid(),
  forening_id  uuid not null references public.forening(id) on delete cascade,
  title        text not null,
  description  text,
  icon         text not null default 'target',
  tint         text not null default '#ede7ff',
  goal         integer not null default 1,
  xp           integer not null default 50,
  active       boolean not null default true,
  sort         integer not null default 0,
  created_at   timestamptz not null default now()
);

-- Per-user progress on a mission.
create table if not exists public.mission_progress (
  id           uuid primary key default gen_random_uuid(),
  mission_id   uuid not null references public.mission(id) on delete cascade,
  forening_id  uuid not null references public.forening(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  progress     integer not null default 0,
  done         boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (mission_id, user_id)
);

-- ---------- INDEXES ----------
create index if not exists idx_membership_user      on public.membership(user_id);
create index if not exists idx_membership_forening   on public.membership(forening_id);
create index if not exists idx_activity_forening     on public.activity(forening_id);
create index if not exists idx_reward_forening       on public.reward(forening_id);
create index if not exists idx_checkin_user          on public.checkin(user_id, created_at desc);
create index if not exists idx_notification_user     on public.notification(user_id, created_at desc);
create index if not exists idx_ledger_forening_user  on public.points_ledger(forening_id, user_id);
create index if not exists idx_mission_forening      on public.mission(forening_id);
create index if not exists idx_mprogress_user        on public.mission_progress(user_id);

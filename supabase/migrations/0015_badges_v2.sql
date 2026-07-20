-- =====================================================================
-- LEVLA — 0015 badges v2 (märken som lockar)
--
-- Ersätter den smala katalogen från 0014 med 27 märken i sex kategorier,
-- och utökar youth_badges() så den även returnerar PROGRESS mot varje mål
-- ("3/5") plus en beskrivning av hur märket låses upp. Utan det är ett
-- låst märke bara en grå ruta — med det blir det ett mål.
--
-- Upplåsning är fortfarande COMPUTED (ingen unlock-tabell): allt räknas
-- fram ur membership / checkin / points_ledger / mission_progress /
-- redemption vid varje anrop.
--
-- Körs fristående: skapar tabellen om 0014 aldrig kördes.
-- =====================================================================

create table if not exists public.badge (
  id        uuid primary key default gen_random_uuid(),
  code      text unique not null,
  name      text not null,
  icon      text not null,
  tint      text not null,
  color     text not null,
  criterion text not null,
  threshold int,
  theme     text,
  sort      int not null default 0
);
alter table public.badge enable row level security;
-- (ingen klientpolicy: bara SECURITY DEFINER-funktionen youth_badges() läser den)

alter table public.badge
  add column if not exists description text    not null default '',
  add column if not exists category    text    not null default 'Märken',
  add column if not exists secret      boolean not null default false;

-- Katalogen är ren referensdata utan FK-beroenden (upplåsningar beräknas),
-- så den kan bytas ut rakt av. Gör migrationen omkörbar.
delete from public.badge;

insert into public.badge (code, name, description, icon, tint, color, criterion, threshold, theme, category, secret, sort) values
  -- ---------- Kom igång ----------
  ('first',       'Premiär',        'Gör din första incheckning',            'check',    '#dcfce7', '#22c55e', 'visits',      1,    null,     'Kom igång',      false,  1),
  ('mission1',    'Uppdragsdebut',  'Klara ditt första uppdrag',             'target',   '#ede7ff', '#6c4cf1', 'missions',    1,    null,     'Kom igång',      false,  2),
  ('shop1',       'Första köpet',   'Växla in poäng i butiken',              'bag',      '#fff3e0', '#c07a1e', 'redemptions', 1,    null,     'Kom igång',      false,  3),

  -- ---------- Närvaro ----------
  ('visits5',     'Stammis',        'Checka in 5 gånger',                    'calendar', '#e0f2fe', '#0ea5e9', 'visits',      5,    null,     'Närvaro',        false, 10),
  ('visits15',    'Trotjänare',     'Checka in 15 gånger',                   'home',     '#ede7ff', '#6c4cf1', 'visits',      15,   null,     'Närvaro',        false, 11),
  ('visits40',    'Inventarie',     'Checka in 40 gånger',                   'shield',   '#ffe9d6', '#ff7a4d', 'visits',      40,   null,     'Närvaro',        false, 12),

  -- ---------- Svit ----------
  ('streak3',     'Uppvärmd',       'Var här 3 dagar i rad',                 'fire',     '#ffe9d6', '#ff7a4d', 'streak',      3,    null,     'Svit',           false, 20),
  ('streak7',     'Eldsjäl',        'Var här 7 dagar i rad',                 'fire',     '#fff3e0', '#ff9500', 'streak',      7,    null,     'Svit',           false, 21),
  ('streak14',    'Ostoppbar',      'Var här 14 dagar i rad',                'diamond',  '#e0f2fe', '#0ea5e9', 'streak',      14,   null,     'Svit',           false, 22),

  -- ---------- Nivå & poäng ----------
  ('level5',      'Nivåryttare',    'Nå nivå 5',                             'trophy',   '#fff3e0', '#ff9500', 'level',       5,    null,     'Nivå & poäng',   false, 30),
  ('level10',     'Legend',         'Nå nivå 10',                            'diamond',  '#ede7ff', '#6c4cf1', 'level',       10,   null,     'Nivå & poäng',   false, 31),
  ('earned1000',  'Poängjägare',    'Tjäna 1 000 poäng totalt',              'coin',     '#fef9c3', '#caa500', 'earned',      1000, null,     'Nivå & poäng',   false, 32),
  ('earned5000',  'Poängkung',      'Tjäna 5 000 poäng totalt',              'coin',     '#fff3e0', '#ff9500', 'earned',      5000, null,     'Nivå & poäng',   false, 33),

  -- ---------- Utforskare ----------
  ('theme_sport', 'Bollkung',       'Var med på en sportaktivitet',          'soccer',   '#e0f2fe', '#0ea5e9', 'theme',       1,    'sport',  'Utforskare',     false, 40),
  ('theme_musik', 'Kreatör',        'Var med på en skapande aktivitet',      'palette',  '#ede7ff', '#6c4cf1', 'theme',       1,    'musik',  'Utforskare',     false, 41),
  ('theme_gaming','Gamer',          'Var med på en gaming-aktivitet',        'gamepad',  '#dcfce7', '#16a34a', 'theme',       1,    'gaming', 'Utforskare',     false, 42),
  ('theme_fika',  'Fikamästare',    'Var med på en fika',                    'coffee',   '#ffe9d6', '#c07a1e', 'theme',       1,    'fika',   'Utforskare',     false, 43),
  ('theme_plugg', 'Pluggis',        'Var med på en pluggträff',              'book',     '#fef9c3', '#caa500', 'theme',       1,    'plugg',  'Utforskare',     false, 44),
  ('theme_fest',  'Festfixare',     'Var med på ett event',                  'sparkles', '#fee2e2', '#ff4d8d', 'theme',       1,    'fest',   'Utforskare',     false, 45),
  ('themes4',     'Allätare',       'Testa 4 olika sorters aktiviteter',     'heart',    '#fee2e2', '#e05a6b', 'themes',      4,    null,     'Utforskare',     false, 46),
  ('themes6',     'Hela gården',    'Testa alla 6 sorters aktiviteter',      'org',      '#ede7ff', '#6c4cf1', 'themes',      6,    null,     'Utforskare',     false, 47),
  ('activities8', 'Utforskare',     'Var med på 8 olika aktiviteter',        'map',      '#dcfce7', '#22c55e', 'activities',  8,    null,     'Utforskare',     false, 48),

  -- ---------- Extra ----------
  ('weekend3',    'Helghjälte',     'Checka in 3 gånger på en lör/sön',      'ticket',   '#fee2e2', '#ff4d8d', 'weekend',     3,    null,     'Extra',          false, 60),
  ('photo3',      'Fotografen',     'Skicka 3 fotobevis',                    'camera',   '#e0f2fe', '#0ea5e9', 'photos',      3,    null,     'Extra',          false, 61),
  ('missions5',   'Uppdragsjägare', 'Klara 5 uppdrag',                       'target',   '#dcfce7', '#16a34a', 'missions',    5,    null,     'Extra',          false, 62),
  ('shop5',       'Storspenderare', 'Lös in 5 belöningar',                   'gift',     '#fff3e0', '#c07a1e', 'redemptions', 5,    null,     'Extra',          false, 63),
  ('night',       'Nattuggla',      'Checka in efter kl 20',                 'moon',     '#f0ebff', '#6c4cf1', 'night',       1,    null,     'Extra',          true,  64);

-- ---------------------------------------------------------------------
-- youth_badges — hela katalogen + progress för den inloggade medlemmen.
-- Alla kriterier är räknare, så unlocked = progress >= goal överallt.
-- ---------------------------------------------------------------------
drop function if exists public.youth_badges(uuid);
create or replace function public.youth_badges(p_forening uuid)
returns table (
  code        text,
  name        text,
  description text,
  icon        text,
  tint        text,
  color       text,
  category    text,
  secret      boolean,
  unlocked    boolean,
  progress    int,
  goal        int,
  sort        int
)
language sql security definer set search_path = '' stable as $$
  with mine as (
    -- Egna incheckningar i föreningen, med aktivitetens tema.
    select ck.activity_id, ck.photo_url, ck.created_at at time zone 'Europe/Stockholm' as local_at, a.theme
      from public.checkin ck
      left join public.activity a on a.id = ck.activity_id
     where ck.user_id = auth.uid() and ck.forening_id = p_forening
  ),
  agg as (
    select
      coalesce((select ms.visits from public.membership ms
                 where ms.user_id = auth.uid() and ms.forening_id = p_forening), 0) as visits,
      coalesce((select ms.streak from public.membership ms
                 where ms.user_id = auth.uid() and ms.forening_id = p_forening), 0) as streak,
      coalesce((select ms.level  from public.membership ms
                 where ms.user_id = auth.uid() and ms.forening_id = p_forening), 1) as level,
      -- Livstidsintjänade poäng, inte saldot: att handla i butiken ska inte
      -- ta tillbaka ett märke man redan låst upp.
      coalesce((select sum(pl.delta)::int from public.points_ledger pl
                 where pl.user_id = auth.uid() and pl.forening_id = p_forening and pl.delta > 0), 0) as earned,
      (select count(distinct m.theme)::int       from mine m where m.theme is not null)       as themes,
      (select count(distinct m.activity_id)::int from mine m where m.activity_id is not null) as activities,
      (select count(*)::int from mine m where m.photo_url is not null)                        as photos,
      (select count(*)::int from mine m where extract(hour   from m.local_at) >= 20)          as night,
      (select count(*)::int from mine m where extract(isodow from m.local_at) >= 6)           as weekend,
      (select count(*)::int from public.mission_progress mp
        where mp.user_id = auth.uid() and mp.forening_id = p_forening and mp.done)            as missions,
      (select count(*)::int from public.redemption r
        where r.user_id = auth.uid() and r.forening_id = p_forening)                          as redemptions
  )
  select b.code, b.name, b.description, b.icon, b.tint, b.color, b.category, b.secret,
         p.value >= g.target             as unlocked,
         least(p.value, g.target)::int   as progress,
         g.target                        as goal,
         b.sort
    from public.badge b
    cross join agg
    cross join lateral (select greatest(coalesce(b.threshold, 1), 1) as target) g
    cross join lateral (select case b.criterion
        when 'visits'      then agg.visits
        when 'streak'      then agg.streak
        when 'level'       then agg.level
        when 'earned'      then agg.earned
        when 'themes'      then agg.themes
        when 'activities'  then agg.activities
        when 'photos'      then agg.photos
        when 'night'       then agg.night
        when 'weekend'     then agg.weekend
        when 'missions'    then agg.missions
        when 'redemptions' then agg.redemptions
        when 'theme'       then (select count(*)::int from mine m where m.theme = b.theme)
        else 0
      end as value) p
   order by b.sort;
$$;
grant execute on function public.youth_badges(uuid) to authenticated;

-- =====================================================================
-- LEVLA — seed data (tenant data only; no users)
-- Creates 1 demo kommun + 3 föreningar with join codes, plus each
-- förening's activities / rewards / missions. User-specific rows
-- (memberships, checkins) appear when a real user signs up & joins.
--
-- Join codes:  CENTRUM · NORRBY · VASTER
-- =====================================================================
do $$
declare
  k  uuid;
  f1 uuid; f2 uuid; f3 uuid;
begin
  -- Only seed once.
  if exists (select 1 from public.forening) then
    raise notice 'Seed skipped: föreningar already exist.';
    return;
  end if;

  insert into public.kommun (name) values ('Ungdomsförvaltningen') returning id into k;

  insert into public.forening (kommun_id, name, color, join_code, lat, lng)
    values (k,'Fritidsgården Centrum', '#2563eb','CENTRUM', 59.3293, 18.0686) returning id into f1;
  insert into public.forening (kommun_id, name, color, join_code, lat, lng)
    values (k,'Ungdomshuset Norrby',   '#7c3aed','NORRBY',  59.3300, 18.0700) returning id into f2;
  insert into public.forening (kommun_id, name, color, join_code, lat, lng)
    values (k,'Aktivitetshuset Väster','#f43f5e','VASTER',  59.3280, 18.0600) returning id into f3;

  -- Activities (Centrum mirrors the prototype; others get a couple each).
  insert into public.activity (forening_id, title, when_text, points, place_label, theme) values
    (f1,'Kvällsfik',          'Varje dag · 18:00', 50, 'Entrén',      'fika'),
    (f1,'Skaparkväll: musik', 'Måndag · 17:00',   120, 'Studion',     'musik'),
    (f1,'Fotbollskväll',      'Onsdag · 18:00',    60, 'Sporthallen', 'sport'),
    (f2,'Öppet hus',          'Fredag · 17:00',    40, 'Foajén',      'fest'),
    (f2,'Gaming-kväll',       'Lördag · 16:00',    70, 'Spelrummet',  'gaming'),
    (f3,'Läxhjälp',           'Torsdag · 15:30',   40, 'Biblioteket', 'plugg');

  -- Rewards (Centrum = the prototype shop).
  insert into public.reward (forening_id, title, tag, icon, tint, cost) values
    (f1,'Fika på gården','Kaffe + bulle','coffee',  '#fff3e0', 150),
    (f1,'Biobiljett',    'Valfri film',  'film',    '#ede7ff', 900),
    (f1,'Event-access',  'LAN / disco',  'ticket',  '#dcfce7', 500),
    (f1,'LEVLA-hoodie',  'Egen merch',   'shirt',   '#fee2e2',2000),
    (f1,'Speltid',       '30 min VR',    'gamepad', '#e0f2fe', 300),
    (f1,'Avatar-skin',   'Guld-Gnista',  'sparkles','#fef9c3', 250),
    (f2,'Fika',          'Kaffe + bulle','coffee',  '#fff3e0', 120),
    (f3,'Biobiljett',    'Valfri film',  'film',    '#ede7ff', 900);

  -- Missions (Centrum).
  insert into public.mission (forening_id, title, description, icon, tint, goal, xp, sort) values
    (f1,'Besök 5 gånger',          'Kom till gården',      'target', '#ede7ff', 5,  80, 1),
    (f1,'Gå på en workshop',       'Skaparkväll el. musik','palette','#ffe9d6', 1, 120, 2),
    (f1,'Hjälp till på ett event', 'Bli volontär en kväll','heart',  '#dcfce7', 1, 150, 3),
    (f1,'Läxhjälp 3 pass',         'Plugga med stöd',      'book',   '#e0f2fe', 3, 100, 4),
    (f2,'Kom 3 kvällar',           'Häng med oss',         'target', '#ede7ff', 3,  60, 1),
    (f3,'Plugga 2 pass',           'Läxhjälp med stöd',    'book',   '#e0f2fe', 2,  80, 1);

  raise notice 'Seed done. Join codes: CENTRUM, NORRBY, VASTER';
end $$;

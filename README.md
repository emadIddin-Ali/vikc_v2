# LEVLA — ungdomsapp (React Native · Expo · Supabase)

Gamifierad närvaro- och belöningsapp för kommunala fritidsgårdar. Ungdomar checkar in
på aktiviteter, samlar XP/poäng, nivåar upp, klarar uppdrag och byter poäng mot belöningar.
Ledare publicerar aktiviteter och tar närvaro; kommunen ser en aggregerad översikt.

Designreferens finns i `design_handoff_levla_app/` (HTML-prototyp + handoff-README).

## Teknik
- **Expo (SDK 54) + Expo Router** (fil-baserad, rollskyddad routing)
- **TypeScript**, **StyleSheet + egna design-tokens** (`src/theme/tokens.ts`), `expo-linear-gradient`, `react-native-svg`
- **Supabase** (Postgres + **Row-Level Security** + Auth) — multi-tenant per **förening**
- **TanStack Query** (server-state) + **Zustand** (installerad för lokal UI-state)
- Typsnitt **Fredoka** via `@expo-google-fonts/fredoka`
- **QR-incheckning:** `expo-camera` (QR-avläsning) + `expo-location` (geofence), server-validerad via RPC
- **Ledarkarta:** `react-native-webview` + Leaflet/OpenStreetMap för att peka ut incheckningsplats (ingen native kartmodul)
- **Kalender/foto/QR:** `@react-native-community/datetimepicker` (tider), `expo-image-picker` + Supabase Storage (fotobevis), `react-native-qrcode-svg` (visa QR)
- **Push (redo, kräver dev build):** `expo-notifications` + `push_token`-tabell + `pg_net`-trigger → Expo push API vid ny notis
- **Polish:** RN `Animated` (konfetti, floaty maskot, ping, XP-bar, toast-slide) + `expo-haptics`, respekterar *reduce motion*

## Multi-tenancy (viktigt)
Varje **förening** är en egen tenant. Alla domänrader bär `forening_id` och isoleras med
RLS-policies som härleds från den inloggade sessionen (`auth.uid()`) — **aldrig** från klienten.
Roller: `ungdom` / `ledare` (per medlemskap) samt kommun-admin (municipal översikt).

## Kom igång

### 1. Installera
```bash
npm install
```

### 2. Supabase-projekt
Skapa ett projekt på [supabase.com](https://supabase.com). Kör sedan SQL:en i ordning
(Supabase Dashboard → **SQL Editor**, eller Supabase CLI):

1. `supabase/migrations/0001_init.sql`  — schema
2. `supabase/migrations/0002_rls_policies.sql` — funktioner, triggers, RLS, RPC:er
3. `supabase/migrations/0003_checkin.sql` — server-validerad incheckning + poäng/nivå/streak-motor
4. `supabase/migrations/0004_missions_shop.sql` — lös in uppdrag + växla poäng i butiken
5. `supabase/migrations/0005_leaderboard.sql` — topplista per förening (+ demo-konkurrenter)
6. `supabase/migrations/0006_ledare.sql` — ledarverktyg (publicera aktivitet, närvaro, KPI:er)
7. `supabase/migrations/0007_ledare_improvements.sql` — närvaro per aktivitet + dashboard-detaljer
8. `supabase/migrations/0008_activity_v2.sql` — schemalagd tid, öppna/kontinuerliga aktiviteter, fotobevis (Storage)
9. `supabase/migrations/0009_windows_limits.sql` — incheckningsfönster, daily-limit, geo-precision, auto-uppdrag
10. `supabase/migrations/0010_forening_location.sql` — sätt föreningens plats (geofence)
11. `supabase/migrations/0011_activity_radius.sql` — radie per aktivitet (egen incheckningsplats)
12. `supabase/migrations/0012_push.sql` — push-tokens + pg_net-trigger som postar till Expo push
13. `supabase/migrations/0013_kommun.sql` — kommunöversikt (aggregerad statistik) + skapa förening
14. `supabase/seed.sql` — demodata (1 kommun, 3 föreningar, aktiviteter/belöningar/uppdrag)

> Med Supabase CLI: `supabase db push` kör migrationerna; seed körs av `supabase db reset`
> lokalt, eller klistra in `seed.sql` i SQL Editor mot ett fjärrprojekt.

**Auth-tips för snabb test:** slå av e-postbekräftelse i Supabase → *Authentication → Sign In / Providers → Email → "Confirm email"* (av), annars måste varje nytt konto bekräftas via mejl.

### 3. Miljövariabler
```bash
cp .env.example .env
```
Fyll i från Supabase (**Project Settings → Data API / API Keys**):
```
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon/publishable key>
```
Anon-nyckeln är publik — RLS skyddar datan. Lägg **aldrig** service_role-nyckeln i appen.

### 4. Starta
```bash
npx expo start
```
Öppna i Expo Go eller en simulator/emulator.

## Testflöde
1. **Skapa konto** (namn, e-post, lösenord).
2. **Gå med i en förening** med en testkod: `CENTRUM`, `NORRBY` eller `VASTER`.
3. Du landar på **ungdomarnas hem-vy** (nivåkort, poäng, uppdrag, senaste besök).
4. (Valfritt) Fyll hem-vyn med demodata — kör i SQL Editor:
   ```sql
   select id, name, join_code from public.forening;         -- hämta förenings-id
   select public.dev_seed_me('<forening-id-för-CENTRUM>');   -- ger dig poäng/notiser/besök
   ```
   Dra ned för att uppdatera / öppna om appen.
5. **Testa incheckning:** tryck på **scan-knappen** (mitten av navigeringen) → låt *Simulera att jag är på plats* vara på → **Simulera skanning**. Du ser **Incheckad!** med +XP/+poäng (och *Level up* om du passerar nivå 1000 XP). Framtvinga en nivåhöjning: `update public.membership set xp=980 where user_id='<uid>' and forening_id='<id>';` och checka in en gång.
6. **Uppdrag & Butik:** öppna **Uppdrag**-fliken → *Lös in* ett klart uppdrag. Gör alla uppdrag inlösbara för test: `select public.dev_ready_missions('<centrum-id>')`. Öppna **Butik** → växla poäng mot en belöning (blir *✓ Uttagen*).
7. **Topplista:** tryck på **trophy-knappen** uppe till höger på hem-vyn → pallplats + lista, med dig själv inrankad bland demo-konkurrenterna.
8. **Ledarvy:** gör dig till ledare (se *Bli ledare* nedan) och logga ut/in → du landar i ledarvyn. Testa *Aktiviteter*, *Närvaro* (**Markera** en ungdom), *Belöningar* (lägg till → syns i butiken).
9. **Admin v2:** i *Aktiviteter* kan du sätta **tid** (datumväljare), välja **Kontinuerlig** + **Öppen incheckning (utan QR)** med **Kräv foto**, samt **Visa QR** per aktivitet. En öppen aktivitet (t.ex. "Besök moskén") checkar ungdomen in på från scan-vyns **"Öppna incheckningar"** (geo-tvingat, foto om det krävs). Klicka en KPI i *Översikt* → **Senaste aktiva** (namn + aktivitet + ev. foto).
10. **Admin v3:** sätt **Incheckningstid (min)** + **Max per dag**. "5 dagliga böner i moskén" = Kontinuerlig + Öppen + plats + Kräv foto + Max/dag `5` → ungdomen ser "3/5 idag" och incheckningen försvinner vid 5/5. Klockan på hem-vyn öppnar **Notiser**. Ny ledarflik **Uppdrag** (slå på *Räkna upp vid incheckning* för auto-progress). Geo tar nu hänsyn till GPS-noggrannhet.

### Bli ledare eller kommun-admin (för att testa de rollerna)
```sql
-- ledare i en förening:
update public.membership set role='ledare'
 where user_id='<ditt-auth-uid>' and forening_id='<forening-id>';

-- kommun-admin (ser hela kommunen):
insert into public.kommun_admin (user_id, kommun_id)
select '<ditt-auth-uid>', id from public.kommun limit 1;
```
Ditt `auth.uid()` hittar du i *Authentication → Users*. Logga ut/in för att byta vy.

## Projektstruktur
```
src/
  app/                     # Expo Router-rutter
    _layout.tsx            #   providers (Auth, Query), fonts, splash
    index.tsx              #   redirect utifrån auth + roll
    auth/                  #   login · sign-up · join (föreningskod)
    ungdom/                #   flikar: Hem · Uppdrag · Scan · Butik · Profil
    ledare/  kommun/       #   rollskyddade ytor (platshållare tills vidare)
  components/              # Icon (SVG-set), Mascot, Card, Screen, YouthTabBar …
  providers/AuthProvider   # session, profil, medlemskap, aktiv förening, roll
  hooks/useHomeData        # hem-vyns läsdata (scopat per förening)
  lib/                     # supabase-klient, typer
  theme/tokens.ts          # färger, typografi, radier, teman, nivånamn
supabase/                  # migrations + seed
```

## Status
- ✅ Projektuppsättning, design-tokens, ikon-/maskotsystem
- ✅ Supabase-schema + RLS + RPC:er + seed
- ✅ Auth (e-post/lösenord) + multi-tenant-context + rollbaserad routing + förening-switch
- ✅ Ungdomarnas hem-vy (kopplad till Supabase)
- ✅ QR- & öppen incheckning med geo-lås (server-validerad: geofence + accuracy-marginal + tidsfönster + daily-limit) + poäng/nivå/streak
- ✅ Uppdrag (lös in XP, auto-progress vid incheckning) + Butik (växla poäng) + Notiser (inkorg)
- ✅ Topplista per förening (server-rankad, med demo-konkurrenter)
- ✅ Ledarverktyg — översikt m. aktiv-lista, agenda/tid + incheckningsfönster, öppna/kontinuerliga aktiviteter (daily-limit), fotobevis, Visa QR, uppdragshantering, närvaro per aktivitet, belöningar, sätt föreningens plats, **redigera & ta bort** aktiviteter/uppdrag
- ✅ Push-pipeline byggd (expo-notifications + pg_net → Expo push) — **aktiveras med en development build** (Expo Go stödjer ej push)
- ✅ Kommunöversikt (superadmin) — aggregerad statistik, öppna förening som ledare, skapa förening
- ✅ Profil — statistik, **Min närvaro** (alla egna incheckningar) och **Märken**: 27 märken i sex kategorier med progress mot varje mål, hemliga märken och egen märkesvy. Upplåsning beräknas ur medlemsdata, ingen unlock-tabell
- ✅ Polish — animationer (konfetti, floaty maskot, ping, XP-bar, toast-slide) + haptik, respekterar *reduce motion*
- ✅ Firande-maskot — Gnista fjädrar in i överstorlek på strålkrans med pulserande ringar vid incheckning och level up
- ✅ Ljud-SFX (`expo-audio`) vid incheckning, level up, nytt märke och poängväxling. Ljuden är **genererade** av `scripts/gen-sfx.mjs` (licensfria, ändra noterna och kör om). Mixas med annat ljud och respekterar iOS tystläge; av/på i profilen
- ✅ Mikrointeraktioner — tryckfeedback på allt tappbart (`Tappable`), siffror som räknar upp/ned (`CountUp`), listor som tonar in i tur och ordning (`FadeIn`), tabbikon som poppar vid byte. Allt respekterar *reduce motion*
- ✅ Tema per förening — en ledare väljer Lila, Soluppgång eller Hav i ledarvyn. Gäller bara den föreningens medlemmar (`0016_forening_theme.sql`)
- ⏭️ Näst: tillgänglighet/tester

## Development build (aktiverar push + laddar snabbare än Expo Go)
Riktig push kräver en dev build — Expo Go (SDK 54) stödjer inte remote push. **`eas.json`, bygg-identifierare (`com.levla.app`) och `expo-dev-client` är redan uppsatta.** En dev build laddar dessutom snabbare än Expo Go (löser laddningsstrulet) och stödjer alla native-moduler. När du vill:
1. Kör `supabase/migrations/0012_push.sql` (aktiverar `pg_net` + push-triggern).
2. Skapa ett Expo-konto och kör `npx eas init` (länkar projektet, sätter projectId).
3. Bygg: `npx eas build --profile development --platform android` (gratis) eller `--platform ios` (kräver Apple Developer-konto).
4. Installera bygget, kör `npx expo start --dev-client`, logga in → push-token registreras automatiskt.
5. Klart: en push skickas varje gång en notis skapas (t.ex. när en ledare lägger upp en aktivitet).

Tills dess är pipelinen vilande och in-app-notiserna (inkorg + klock-badge) fungerar som vanligt i Expo Go.

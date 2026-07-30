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
Roller: `ungdom` / `ledare` / `foralder` / `larare` (per medlemskap) samt kommun-admin (municipal översikt).
`larare` är spärrad tills en ledare godkänner den (`membership.larare_godkand`) och ser bara sina egna
klasser — aldrig föreningens register.

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
14. `supabase/migrations/0014_badges.sql` — märken (global katalog, upplåsning beräknas ur medlemsdata)
15. `supabase/migrations/0015_badges_v2.sql` — märken v2 (27 märken i sex kategorier, progress + hemliga märken)
16. `supabase/migrations/0016_forening_theme.sql` — tema per förening (Lila/Soluppgång/Hav)
17. `supabase/migrations/0017_reward_stock.sql` — antal/lager per belöning (butiken visar "12 kvar")
18. `supabase/migrations/0018_missions_v2.sql` — uppdrag i två typer: Mål (auto) + Uppgift (markeras klar)
19. `supabase/migrations/0019_checkout.sql` — utcheckning (poäng ges vid utcheckning, QR-omskanning eller knapp)
20. `supabase/migrations/0020_forening_info.sql` — föreningsinfo + logotyp (Storage-bucket + RPC)
21. `supabase/migrations/0021_google_name.sql` — hämta namn från Google-konton vid inloggning
22. `supabase/migrations/0022_parent_role.sql` — enum-värdet `foralder`. **Kör för sig, före 0023** (`alter type … add value` får inte ligga i samma körning som något som använder värdet)
23. `supabase/migrations/0023_parents.sql` — föräldrar + barn (barn utan eget konto, incheckning å barnets vägnar, barn i topplista + ledarstatistik)
24. `supabase/migrations/0024_security_hardening.sql` — **säkerhetshärdning inför lansering** (tvingad geofence, privat fotobucket, borttagna fuskfunktioner, strikt membership-RLS, kontoradering). **Kör i produktion.** Se *Lansering* nedan.
25. `supabase/migrations/0025_activity_expiry.sql` — enstaka (icke-kontinuerliga) aktiviteter går ut efter sitt tidfönster (start + tid, annars slutet av dagen); de slutar synas och gå att checka in på. Kör efter 0024.
26. `supabase/migrations/0026_personnummer.sql` — ledaren kan kräva **personnummer** för att gå med (register per förening). Personnummer lagras på membership + child, valideras (Luhn), och är åtkomligt bara för egen användare/förälder + ledare. **Känsliga uppgifter — måste in i integritetspolicyn + registerförteckningen.** Kör efter 0025.
27. `supabase/migrations/0027_larare_role.sql` — enum-värdet `larare`. **Kör för sig, före 0028** (samma regel som 0022).
28. `supabase/migrations/0028_klasser.sql` — **lärarrollen**: klasser, elever (medlem eller barn), lektioner med närvaro, och stjärnor 1–5 som växlas till XP enligt föreningens kurva (`forening.star_xp`, default 25/60/110/180/300). Närvaron skrivs som incheckning så streak/besök/Mål-uppdrag fortsätter gälla. Ångrade stjärnor backas ut i stället för att raderas. Kör efter 0027.
29. `supabase/migrations/0029_klass_roster.sql` — klasslistan blir en lista att bocka i (läraren lägger till och tar bort elever i samma vy). Kör efter 0028.
30. `supabase/migrations/0030_marknad.sql` — **marknaden**: butiken har öppettider (`marknad`-tabellen), belöningar är antingen `marknad` (bara när den är öppen) eller `alltid` (pizzabiten), `limit_per_member` styr hur många gånger samma medlem får ta en belöning, och **barn kan handla för sina egna poäng** (`redemption.child_id`). Stjärnor ger butikspoäng som standard (`star_points_factor` 0 → 0.5). Ingen marknad upplagd = butiken alltid öppen, precis som förut. Kör efter 0029.
31. `supabase/migrations/0031_xp_ekonomi.sql` — **poängekonomin**. `xp_ledger` blir huvudbok för XP (fylls av triggers på `checkin` och `stjarna`, så inga incheckningsfunktioner behöver skrivas om). **Topplistan rankar på säsongens XP** i stället för på poängsaldot — att handla i butiken kostade tidigare placering. En säsong löper mellan två marknader. **Sviten räknas i veckor** (`week_streak`) och tål ett hopp; en daglig svit gick aldrig att hålla i en förening som är öppen några kvällar i veckan. Nytt **veckomål** per förening (`week_goal`) som ger XP + poäng, **märken ger XP** (`badge.xp` + `badge_unlock` + `sync_badge_xp()`), och uppdrag ger bara XP — inte butikspoäng. Kör efter 0030.
32. `supabase/seed.sql` — demodata (1 kommun, 3 föreningar, aktiviteter/belöningar/uppdrag). **Endast för test — kör ALDRIG i produktion.**

> Med Supabase CLI: `supabase db push` kör migrationerna; seed körs av `supabase db reset`
> lokalt, eller klistra in `seed.sql` i SQL Editor mot ett fjärrprojekt.

**Auth-tips för snabb test:** slå av e-postbekräftelse i Supabase → *Authentication → Sign In / Providers → Email → "Confirm email"* (av), annars måste varje nytt konto bekräftas via mejl. **⚠️ I produktion måste "Confirm email" vara PÅ** — annars kan konton skapas på andras e-postadresser.

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
7. **Topplista:** tryck på **trophy-knappen** uppe till höger på hem-vyn → pallplats + lista med föreningens ungdomar och ev. föräldratillagda barn (du själv markerad). Fejkade demo-konkurrenter visas inte längre (borttaget i `0024` inför lansering).
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
    ledare/  kommun/       #   rollskyddade ytor (ledarverktyg · kommunöversikt)
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
- ✅ Antal per belöning — ledaren sätter t.ex. 15 biobiljetter; butiken visar "12 kvar" och slutsåld när de tar slut (`0017_reward_stock.sql`)
- ✅ Uppdrag v2 — två tydliga typer: **Mål** (fylls automatiskt av incheckningar, löses in när stapeln är full) och **Uppgift** (gör själv & markera klart för XP). Egna sektioner + förklaring i både ungdoms- och ledarvyn, så aktivitet vs uppdrag inte blandas ihop (`0018_missions_v2.sql`)
- ✅ Utcheckning — en aktivitet kan kräva att man stannar kvar: poängen ges först vid **utcheckning**, via QR-omskanning eller en geo-verifierad "Checka ut"-knapp. Öppna sessioner visas på hem-vyn och scan-skärmen (`0019_checkout.sql`)
- ✅ Föreningsflik — egen flik i ledarmenyn där alla ledare i föreningen redigerar delad info (namn, beskrivning, adress, kontakt, öppettider) och laddar upp en **logotyp** (Supabase Storage). Logotypen visas för ungdomarna på hem-vyn (`0020_forening_info.sql`)
- ✅ Google-inloggning — "Fortsätt med Google" på logga in/skapa konto; webb-OAuth via `expo-web-browser` (PKCE), fungerar i Expo Go. Kräver konfiguration i Supabase + Google Cloud (se *Google-inloggning* nedan) (`0021_google_name.sql`)
- ✅ Förälder-roll (grunderna) — man går med i föreningen som **förälder** och lägger till **barn** (profiler utan eget konto, för små barn utan telefon). Föräldern checkar in barnet på plats (QR/geo, samma anti-fusk-regler) och poängen krediteras barnet. Egna poäng/nivå/streak + närvarohistorik per barn; barnen syns i ledarens KPI:er/senaste-lista och på topplistan (förälderns egna barn markerade). Märken/uppdrag/butik för barn = senare (`0022_parent_role.sql`, `0023_parents.sql`)
- ⏭️ Näst: tillgänglighet/tester; märken/uppdrag/butik för barn

## Lansering — GDPR & säkerhet

Appen behandlar **barns** personuppgifter, så både App Store/Play Store och svensk lag (GDPR + dataskyddslagen, tillsyn av IMY) ställer krav. En säkerhets- och GDPR-revision är gjord; det mesta är åtgärdat i kod, men vissa steg måste **du** göra manuellt.

### Åtgärdat i kod (den här omgången)
- **Tvingad geofence** — `check_in`/`check_out`/`check_in_child` kunde tidigare kringgås genom att skicka `null`-koordinater. Nu krävs position när platsen finns (`0024`).
- **Privat fotobucket** — `checkin-photos` var publik (barns foton läsbara för vem som helst med URL:en). Nu privat, med storleks-/typgräns; ägar-scopad uppladdning; ledare ser foton via **signerade URL:er** (`0024`, `src/lib/photo.ts`).
- **Borttagna fuskfunktioner** — `dev_seed_me`/`dev_ready_missions` (gav vem som helst poäng) och "Simulera skanning"-knappen är borta ur produktion (`0024`, `scan.tsx` gatead med `__DEV__`).
- **Strikt membership-RLS** — en ungdom kunde läsa alla andras poäng/besök/streak. Nu bara egen rad + ledare/kommun (`0024`).
- **Kontoradering (GDPR art. 17)** — `Profil → Radera konto` raderar kontot, all data (cascade) **och** uppladdade foton ur storage (`0024`, `AuthProvider`, `profil.tsx`).
- **Integritetspolicy** — skärm på `/legal/privacy`, länkad från registrering och profil (`src/app/legal/privacy.tsx`).
- **Ålder/samtycke** — obligatorisk bekräftelseruta vid registrering (minst 13 år eller målsmans godkännande + policy). Gäller både e-post och Google.
- **Push vid utloggning** — token raderas vid logga ut/radera konto (delade enheter).
- **Övrigt** — `redeem_reward` låser nu medlemsraden (inget negativt saldo); topplistan visar inga fejkade demo-konkurrenter; foto-EXIF/GPS strippas; testkoder döljs i produktion; app-namn satt till **LEVLA**; iOS `ITSAppUsesNonExemptEncryption=false`.

### Måste göras manuellt före lansering (BLOCKERANDE)
- [ ] **Kör `0024_security_hardening.sql`** i produktionsprojektet (efter 0001–0023).
- [ ] **Separat prod-Supabase i EU-region** (Stockholm/Frankfurt) — kör INTE `seed.sql` där. Sätt **"Confirm email" PÅ**.
- [ ] **Fyll i integritetspolicyn** — ersätt platshållarna `[ ... ]` i `src/app/legal/privacy.tsx` (personuppgiftsansvarig, kontakt-e-post, region, lagringstid, datum) och **publicera den på en offentlig URL** (krävs av båda butikerna). Enklaste vägen: kopiera texten till en enkel webbsida.
- [ ] **`npx eas init`** — sätter `projectId` (utan den fungerar inte push i prod-build).
- [ ] **Rättslig grund & ansvar** — bestäm vem som är personuppgiftsansvarig (förening/kommun) och teckna **personuppgiftsbiträdesavtal (DPA)** mellan appleverantören och huvudmannen. Upprätta **registerförteckning (art. 30)**. En app som systematiskt behandlar barns närvaro är en trolig **DPIA**-kandidat enligt IMY:s lista — gör en bedömning.
- [ ] **Butiksformulär** — iOS *Privacy Nutrition Labels* och Android *Data Safety*: samlar e-post, namn, foton, användar-ID, grov användningsdata; plats **används men lagras ej / ej för spårning**. Ingen reklam, ingen tredjepartsspårning.
- [ ] **Barnmålgrupp** — överväg Apple *Kids Category* / Google Play *Families*-policy (striktare krav; appen saknar reklam vilket hjälper). Kräver publik policy-URL + kontoradering (båda klara).

### Bör göras (rekommenderat, ej blockerande)
- [ ] **Auth-token i SecureStore** — byt AsyncStorage mot `expo-secure-store` i `src/lib/supabase.ts` (paketet finns redan). Känsligt på delade barn-enheter.
- [ ] **Gallring/retention** — definiera lagringstid för `checkin`/`points_ledger`/`notification` och sätt upp ett städjobb (pg_cron).
- [ ] **Dataexport (art. 15/20)** — minst en manuell SQL-mall per `user_id`; in-app-export är en bonus.
- [ ] **Deep links** — lägg `associatedDomains` (iOS) + Android App Links (`autoVerify`) för verifierade återanrop (härdar OAuth).
- [ ] **Rök-/E2E-test** av auth + incheckning innan release (ingen CI finns).

## Google-inloggning (konfiguration)
Koden är klar (`Fortsätt med Google` på logga in/skapa konto). För att den ska fungera behöver **du** koppla ihop Google + Supabase — inga hemligheter ligger i appen.

1. **Google Cloud** → skapa ett OAuth-klient-ID (typ *Web application*) i *APIs & Services → Credentials*.
   - **Authorized redirect URI:** `https://<ditt-ref>.supabase.co/auth/v1/callback` (Supabase återanropas av Google).
   - Kopiera **Client ID** och **Client secret**.
2. **Supabase** → *Authentication → Providers → Google*: slå på, klistra in Client ID + Client secret, spara.
3. **Supabase** → *Authentication → URL Configuration → Redirect URLs*: lägg till appens återanrop så Supabase får skicka tillbaka användaren till appen:
   - Dev build / skarpt: `vikcv2://**` (appens `scheme` från `app.json`).
   - Expo Go: lägg även till `exp://**` (Expo Go använder `exp://`-schemat). Tips: appen loggar redirect-URL:en i konsolen vid ett inloggningsförsök om du vill ha den exakt.
4. Klart. Ett nytt Google-konto skapas automatiskt (namnet hämtas från Google via `0021_google_name.sql`); användaren landar på *Gå med i förening* precis som ett e-postkonto.

> Flödet använder PKCE: appen öppnar Googles inloggning i en in-app-webbläsare och byter sedan `?code` mot en session. Fungerar i Expo Go — ingen native Google-modul behövs.

## Development build (aktiverar push + laddar snabbare än Expo Go)
Riktig push kräver en dev build — Expo Go (SDK 54) stödjer inte remote push. **`eas.json`, bygg-identifierare (`com.levla.app`) och `expo-dev-client` är redan uppsatta.** En dev build laddar dessutom snabbare än Expo Go (löser laddningsstrulet) och stödjer alla native-moduler. När du vill:
1. Kör `supabase/migrations/0012_push.sql` (aktiverar `pg_net` + push-triggern).
2. Skapa ett Expo-konto och kör `npx eas init` (länkar projektet, sätter projectId).
3. Bygg: `npx eas build --profile development --platform android` (gratis) eller `--platform ios` (kräver Apple Developer-konto).
4. Installera bygget, kör `npx expo start --dev-client`, logga in → push-token registreras automatiskt.
5. Klart: en push skickas varje gång en notis skapas (t.ex. när en ledare lägger upp en aktivitet).

Tills dess är pipelinen vilande och in-app-notiserna (inkorg + klock-badge) fungerar som vanligt i Expo Go.

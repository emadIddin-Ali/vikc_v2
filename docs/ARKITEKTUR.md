# LEVLA — arkitektur, ekonomi och säkerhetsmodell

Kompletterar README (som beskriver *vad* appen gör). Det här dokumentet beskriver *reglerna* —
sådant som är lätt att bryta av misstag när man lägger till en funktion.

---

## 1. Multi-tenancy

**Föreningen är tenant.** Varje domänrad bär `forening_id` och isoleras med RLS som härleds ur
sessionen (`auth.uid()`) — aldrig ur något klienten skickar.

Två hjälpare i schemat `private` bär hela modellen:

| Hjälpare | Svarar på |
|---|---|
| `private.can_access_forening(fid)` | Är jag medlem i föreningen, eller kommun-admin över den? |
| `private.has_forening_role(fid, roll)` | Har jag den här rollen där? (kommun-admin räknas som ledare) |

De är `SECURITY DEFINER` för att de ska kunna läsa `membership` utan att utlösa RLS på `membership`
— annars blir policyutvärderingen rekursiv.

---

## 2. Roller

| Roll | Ser | Kan |
|---|---|---|
| `ungdom` | sin egen data, aktiviteter, butik, topplista | checka in, lösa uppdrag, handla |
| `foralder` | sina egna barn | lägga till barn, checka in dem, handla åt dem |
| `larare` | **bara sina egna klasser** | skapa klasser, adoptera elever, hålla lektioner, sätta stjärnor |
| `ledare` | hela föreningen inkl. personnummerregistret | allt administrativt i föreningen |
| kommun-admin | alla föreningar i kommunen | öppna en förening som ledare, skapa föreningar |

Rollen ligger på **medlemskapet**, inte på användaren — samma person kan vara ungdom i en förening
och ledare i en annan.

**Läraren är spärrad tills en ledare godkänner** (`membership.larare_godkand`). Utan den spärren
hade vem som helst som fått föreningskoden kunnat ge sig själv lärarbehörighet.
`private.is_larare(fid)` kräver både rollen och godkännandet.

En lärare kan **inte** läsa medlemsregistret, andras incheckningar eller barn utanför sina klasser.
Elevlistan läraren adopterar ur (`forening_elever`) returnerar namn, avatar och födelseår — aldrig
personnummer.

---

## 3. Ekonomin

> **Poäng tjänas genom att komma och spenderas i butiken.
> XP tjänas genom att prestera och kan aldrig spenderas.
> Topplistan rankar på XP, aldrig på poäng.**

| | Källa | Används till | Kan minska |
|---|---|---|---|
| **Poäng** | incheckning, utcheckning, veckomål | butiken | ja, när du handlar |
| **XP** | incheckning, uppdrag, stjärnor, märken, veckomål | nivå + topplista | nej |
| **Stjärnor** | lärarens bedömning 1–5 | växlas till XP (+ ev. poäng) | nollställs veckovis i vyer |

Ranking på poäng betydde att den som handlade tappade placering — och med marknad varannan månad
mätte listan i praktiken vem som ännu inte hunnit handla.

### `xp_ledger` är huvudbok

**Lägg aldrig till en XP-källa utan att skriva till `xp_ledger`.** Säsonger, veckokortet och all
statistik läser därifrån; `membership.xp` / `membership.level` är bara cache.

Huvudboken fylls av **triggers**, inte av att varje funktion skriver till den:

- `on_checkin_ekonomi` på `checkin` — XP, veckosvit och veckomål
- `on_stjarna_xp` på `stjarna` — utdelade och ångrade stjärnor

Det var ett medvetet val: de sex incheckningsfunktionerna bär geofence, tidsfönster, dagsgränser och
fotokontroller, och att skriva om dem för att lägga till en rad hade varit den riskabla vägen.

> **Checkin-triggern är `DEFERRABLE INITIALLY DEFERRED` — rör inte det.**
> `check_in()` skriver checkin-raden *först* och uppdaterar `membership.xp` *efteråt* med värden den
> räknat ut i förväg. En vanlig `AFTER`-trigger hade delat ut veckobonusens XP innan den
> uppdateringen, och funktionen hade skrivit över den. Vid commit har allt annat redan hänt.

### Säsong

En säsong löper **mellan två marknader** (`private.sasong_start`). Har föreningen inga marknader är
säsongen kalendermånaden. Topplistan nollställs när marknaden öppnar, så rangordningen avgörs vid ett
verkligt tillfälle. Förra säsongens pall räknas fram ur huvudboken — ingen cron behövs.

### Sviten räknas i veckor

`week_streak` = veckor i rad med minst ett besök, och den **tål ett hopp**: missar du en vecka lever
den vidare, missar du två börjar den om. En daglig svit gick aldrig att hålla i en förening som är
öppen några kvällar i veckan, så siffran var död. Frysningen är härledd ur historiken
(`private.veckosvit`) i stället för lagrad som ett saldo.

Den gamla `streak`-kolumnen skrivs fortfarande av incheckningsfunktionerna men visas ingenstans.

### Butiken

Butiken har öppettider. `reward.availability` är `'marknad'` (bara när en marknad är öppen) eller
`'alltid'` (pizzabiten). `reward.limit_per_member` styr hur många gånger samma person får ta den —
`null` = obegränsat, samma konvention som `stock`.

**En förening utan marknader har alltid öppen butik.** Funktionen slås på genom att lägga upp den
första marknaden, inte genom en inställning.

Barn handlar för sina egna poäng: `redeem_reward(p_reward, p_child)` och `youth_shop(p_forening,
p_child)` tar båda ett valfritt barn, och saldot hämtas från `child.points`.

---

## 4. Barn utan konto

Ett `child` är en profil utan inloggning som en förälder äger. Överallt där ett barn kan vara
subjektet används samma polymorfi:

```
user_id  = den som utförde handlingen (föräldern eller läraren)
child_id = den som krediteras
```

Så ser `checkin`, `points_ledger`, `xp_ledger`, `redemption`, `klass_elev` och `stjarna` ut. Läser du
statistik för en person: filtrera på `child_id = X` för barn, och på
`user_id = X and child_id is null` för medlemmar. **Glömmer du `child_id is null` blandar du in
förälderns barns rader i förälderns egen statistik** — det var en verklig bugg i `youth_badges`.

---

## 5. Skrivvägar

All skrivning som rör poäng, XP, roller eller andras data går genom `SECURITY DEFINER`-RPC:er.
Tabellerna har **inga write-policyer** för de flödena — bara `select`.

Undantag där ledaren skriver direkt mot tabellen (RLS-skyddat med `has_forening_role(…,'ledare')`):
`activity`, `reward`, `mission`.

Funktioner i `private` som **muterar** (`apply_xp`, `bump_streak`, `log_xp`) har inte `EXECUTE` för
`authenticated`. De anropas bara från definer-funktioner, som kör som ägaren. Lägger du till en
muterande hjälpare i `private` — ge den inget grant.

---

## 6. Anti-fusk

| Skydd | Var |
|---|---|
| Geofence krävs när platsen finns | `check_in`, `check_out`, `open_checkin`, barnvarianterna |
| Tidsfönster + aktivitetens utgång | `0025` |
| Max per dag per aktivitet | `activity.daily_limit` |
| Karens 3 min mellan incheckningar | incheckningsfunktionerna |
| Fotobevis validerat mot egen mapp | `0024` |
| Stjärntak per lärare, elev och vecka | `forening.star_max_per_vecka` |
| En stjärnsättning per elev och lektion | unikt index på `stjarna` |
| Inga negativa belopp | `reward.cost`, `activity.points`, `mission.xp` ≥ 0 (`0032`) |
| Ångra, aldrig radera | `stjarna.voided_at` + motbokning i `xp_ledger` |

---

## 7. Migrationsordning

Kör i nummerordning. **`0022` och `0027` måste köras var för sig** — Postgres tillåter inte att
`alter type … add value` delar transaktion med kod som använder värdet.

Nuvarande kedja efter lanseringshärdningen: `0024` → `0025` → `0026` → **`0027`** → `0028` → `0029`
→ `0030` → `0031` → `0032`.

Alla migrationer är omkörbara.

---

## 8. Personuppgifter

Personnummer lagras på `membership` och `child` och är åtkomligt för egen användare / förälder samt
ledare — aldrig för lärare, aldrig i elevlistor. Det är särskilt skyddsvärt (GDPR art. 87 + 3 kap.
10 § dataskyddslagen) och **måste** finnas i integritetspolicyn och registerförteckningen.

Fotobeviset ligger i en privat bucket och serveras via signerade URL:er.

`delete_my_account` raderar `auth.users`-raden; allt domändata följer med via cascade. Klasser och
stjärnhistorik överlever att en *lärare* raderar sitt konto (`larare_user_id` sätts till null) — då
måste en ledare ge klassen en ny lärare.

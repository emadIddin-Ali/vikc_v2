# LEVLA — arbetsregler

## Expo HAS CHANGED

Projektet är **låst till Expo SDK 54** — det är den version användarens Expo Go kör.
Uppgradera inte SDK:n utan att bli ombedd.

Läs de exakta versionerade dokumenten på https://docs.expo.dev/versions/v54.0.0/ innan du skriver kod.

## Databasen ägs av användaren

Supabase-projektet är användarens. Leverera **SQL-filer** i `supabase/migrations/` — skapa eller
migrera aldrig via en MCP-anslutning. Användaren kör dem själv i SQL-editorn, i nummerordning.

Ett `alter type ... add value` (nytt enum-värde) måste ligga i en **egen** migration, före den som
använder värdet. Se `0022` och `0027`.

## Ekonomins grundregel

**Poäng tjänas genom att komma och spenderas i butiken. XP tjänas genom att prestera och kan aldrig
spenderas. Topplistan rankar på XP, aldrig på poäng.**

Lägg aldrig till en XP-källa utan att skriva till `xp_ledger`. Se `docs/ARKITEKTUR.md`.

# Flowa Command Center

Internt driftsdashboard for Flowa (appointment setting-bureau). Viser vores eget salg og — fra den dag vi har kunder — leveringen til dem. Kører 100% lokalt: ingen database, ingen auth, ingen cloud.

Designprincip: **decision-first**. Enhver skærm skal fortælle dig hvad et tal betyder og hvad du gør ved det — ikke bare vise tallet. Se `lib/alerts.ts` og `lib/next-actions.ts`, som er systemets "hjerne": rene, testede funktioner der beregner alarmer og den næste bedste handling ud fra data og `settings.json`.

## Kom i gang

```bash
npm install
npm run dev
```

Det starter både Vite (frontend, `:5173`) og Express-serveren (API, `:4000`) samtidig. Åbn `http://localhost:5173`.

Andre kommandoer:

```bash
npm run test        # kør alarm- og next-action-testene (vitest)
npm run build        # typecheck + production build
npm run seed:full     # gendan demo-datasættet (2 kunder, historik, alt kan ses virke)
npm run seed:empty    # nulstil til vores rigtige nul-kunde-tilstand (ingen kunder, kun eget salg)
```

`seed:full` er det datasæt repoet leveres med, så alle moduler kan ses fungere. Kør `npm run seed:empty` den dag I rent faktisk skal bruge systemet til noget — det giver et ærligt udgangspunkt: ingen kunder, en lille rigtig prospect-liste, ingen opdigtet leveringshistorik.

## Hvordan filerne hænger sammen

Alt data ligger som JSON i `/data`, én fil pr. domæne — læs og redigér dem direkte i en editor (eller lad Claude gøre det), de behøver ikke gå gennem UI'et. `src/schema.ts` er single source of truth for formen på hver fil (Zod-skemaer); en ødelagt fil fejler tydeligt ved indlæsning i stedet for at give en hvid skærm.

| Fil | Indhold |
|---|---|
| `clients.json` | Vores kunder — kontrakt, honorar, kanaler, ICP |
| `prospects.json` | Vores egen salgspipeline (aldrig knyttet til en kunde) |
| `campaigns.json` | Kampagner, `clientId: null` = Flowas eget salg |
| `outreach.json` | Dagligt aggregat pr. kampagne — email og telefon holdes adskilt |
| `meetings.json` | Alle møder — vores egne (`clientId: null`) og leverede til kunder |
| `invoices.json` | Fakturaer pr. kunde pr. måned |
| `infrastructure.json` | Afsenderdomæner/indbakker (intern) |
| `costs.json` | Faste/variable omkostninger (intern) |
| `tasks.json` | Opgaver, kan knyttes til en kunde/prospect/møde/kampagne |
| `goals.json` | Mål pr. periode |
| `settings.json` | Al forretningslogik og alle tærskler — intet er hardcodet i React |
| `enums.json` | Alle statusser/årsager/kanaler med dansk label, centralt |
| `team.json` | Teammedlemmer (`ownerId` på entiteter peger herind) |
| `alerts_state.json` | Kun udsatte/kvitterede alarmer — selve alarmerne beregnes, gemmes ikke |
| `activity.json` | Automatisk log, skrevet af serveren ved enhver mutation |

Serveren (`server/index.ts`) serverer disse filer over et lille REST-API og validerer enhver skrivning mod `schema.ts`, før den rammer disk. `GET /api/data` henter det hele i ét kald; `POST/PATCH/DELETE /api/<collection>/:id` mutér.

## Tilføj en kunde

1. Åbn `data/clients.json` og tilføj et objekt (kig på et eksisterende for feltnavne) — eller brug UI'et (der er endnu ikke en "opret kunde"-formular i UI, kun quick-add for møder/prospects/tasks/omkostninger, så nye kunder oprettes i filen).
2. Sæt `performanceUdløser` til `booket`, `afholdt` eller `godkendt` alt efter hvad kontrakten siger.
3. Tilføj mindst én kampagne i `campaigns.json` med `clientId` sat til kundens id, og en tilsvarende gruppe rækker i `outreach.json`, så Kampagner-modulet har noget at vise.
4. Alarm- og leveringsmodulerne opdager kunden automatisk — intet andet skal konfigureres.

## Tilføj en kampagne

Tilføj et objekt i `campaigns.json`. `clientId: null` betyder Flowas eget salg; ellers skal `clientId` matche en eksisterende kunde. `kanal` er `email` eller `telefon` — bland aldrig de to i samme kampagne, da tragtene holdes adskilt i `outreach.json`.

## Interne felter — må ikke eksponeres i en fremtidig kundevisning

Data er struktureret så alt kan filtreres rent på `clientId`, og de interne felter er markeret med `/** internal: … */`-kommentarer direkte i `src/schema.ts`. Kort opsummeret, disse felter må aldrig vises til en kunde:

- **Client**: `retainerBeløb`, `performanceBeløbPrMøde`, `opsigelsesvarsel`, `noter`
- **Meeting**: `faktureres`, `noter`
- **Hele filer**: `infrastructure.json` og `costs.json` er udelukkende interne
- Health-score (beregnet i `lib/alerts.ts`), dækningsbidrag og alt i `lib/capacity.ts` / `clientMonthlyEconomics()` er interne beregninger

## Arkitektur i korte træk

- **Alarmmotor** (`src/lib/alerts.ts`): rene funktioner, tager hele datasættet + `settings.json`, returnerer rangerede alarmer. Tester i `alerts.test.ts`.
- **Næste bedste handling** (`src/lib/next-actions.ts`): scorer kandidathandlinger på konsekvens/hastende/indsats (formlen ligger ét sted i `scoreAction()`), returnerer 5-7 udførbare punkter.
- **Sider** (`src/pages/`): rent visningslag, henter alt via `useData()` (`src/hooks/useData.tsx`), som holder styr på det fulde datasæt, alarmer og handlinger.
- **Design-tokens** (`tailwind.config.ts`): to adskilte paletter — `brand` (orange, identitet) og `status` (grøn/blå/rød, betydning). De må aldrig blandes; se kommentaren i filen.

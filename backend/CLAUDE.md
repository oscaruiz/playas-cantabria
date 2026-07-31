# Playas Cantabria — Backend

## What it is

REST API for beach weather forecasts in Cantabria, Spain. Express + TypeScript, hexagonal architecture (Ports & Adapters), deployable locally or as Firebase Functions.

## Commands

```bash
npm run dev          # dev with hot-reload (tsx watch)
npm run build        # compile TS → dist/ (tsc -p config/tsconfig.json)
npm run start        # production (node dist/index.js)
npm test             # vitest
npm run test:scraper # manual AEMET scraper test (tsx)
npx tsc -p config/tsconfig.json --noEmit  # type-check without emitting
```

## Architecture

Strict hexagonal. Dependencies ALWAYS point inward:

```
infrastructure/ → application/ → domain/
     ↑ never the other way
```

### Layers

- **domain/entities/**: pure types (Beach, Weather, Flag, Tides, BeachForecast). No infra imports.
- **domain/ports/**: interfaces (BeachRepository, WeatherProvider, FlagProvider, TidesProvider). Adapters implement these.
- **domain/use-cases/**: business logic (GetAllBeaches, GetBeachById, GetBeachDetails with AEMET→OpenWeather hedging).
- **application/dtos/**: public API shapes (BeachDTO, BeachDetailsDTO).
- **application/mappers/**: entity → DTO (BeachMapper, LegacyDetailsMapper).
- **application/services/**: orchestration (LegacyDetailsAssembler — data fallback chain).
- **application/validation/**: Zod schemas for route params.
- **infrastructure/providers/**: external data adapters (AEMET API, OpenWeather, Red Cross scraping, AEMET web scraping).
- **infrastructure/repositories/**: JsonBeachRepository (reads data/beaches.json).
- **infrastructure/express/**: server, middlewares, routers.
- **infrastructure/di/**: manual DI container (DIContainer, dependencies.ts).
- **infrastructure/cache/**: InMemoryCache with TTL and singleflight dedup.
- **regions/**: registry and validated runtime config loaded from root `regions/<id>/`. Express creates one container per valid region; weather providers are shared while repositories and flag routers remain regional.

### DI Container

Everything is registered in `infrastructure/di/dependencies.ts`. No DI framework — manual factory functions. Singletons are created lazily on first access.

To add a new service:
1. Create the class in the appropriate layer.
2. Register in `dependencies.ts` with `container.registerSingleton()` or `container.register()`.
3. Update `SERVICES` in `di/index.ts` to expose by name.

## Data providers — Fallback chain

The app fetches data from multiple sources. If one fails, it falls through to the next. **NEVER delete an existing provider** — only add new ones above in the chain.

### Beach forecast (endpoint /api/beaches/:id/details)

```
Layer 1: AemetBeachWebScraper        → public XML/HTML from aemet.es (3 days, morning/afternoon, tides, warnings, real UV)
Layer 2: AemetBeachForecastProvider  → OpenData API with API key (2 days, inconsistent JSON structure)
Layer 3: OpenWeatherWeatherProvider  → OpenWeather API (temp, wind, description)
```

Orchestration lives in `LegacyDetailsAssembler.assemble()`.

### Hedged weather (inside GetBeachDetails use-case)

```
AEMET observation API (AemetWeatherProvider) ←→ OpenWeather (hedged — first to respond wins)
```

### Beach flag

```
FlagProviderRouter → dispatches by FlagRef.provider (neutral port)
  'cruzroja' → RedCrossFlagProvider → HTML scraping from cruzroja.es (independent, always runs in parallel)
```

Beaches carry provider-neutral `FlagRef`s (`{ provider: 'cruzroja', ref: <id> }`), derived by
JsonBeachRepository from the catalog's `idCruzRoja`/`cruzRojaStations` (the "0 = no coverage"
convention is resolved there). Use cases only see the `FlagProvider` port (`getFlag(ref)`).

### Adding a flag operator (supported extension)

1. Adapter implementing `FlagProvider` in `infrastructure/providers/`.
2. Add its id to `FlagProviderId` and its public name to `FLAG_OPERATOR_NAMES`
   (`domain/entities/Flag.ts`). The name is engine data, not region data: an operator is the
   same organisation wherever it works.
3. Register it in the DI router map (`dependencies.ts`) and list its id in the region's
   `flagProviders`.

No UI change is needed: the API reports the operator per beach in `fuenteBanderas` and the
frontend reads the name from there.

### Regions with no flag operator

`flagProviders: []` is a supported configuration, not a degraded one. The API answers
`fuenteBanderas: null` (explicit null, never absent — that is what tells a client "nobody watches
this beach" apart from "this backend does not report it"), the interface hides the flag section,
and `BeachScorer` **takes the flag factor out of the score and rescales to 100**. Scoring it as
"no data" would dock every beach in the region the same ~22 points and read as bad conditions.

## AEMET data sources

### Public XML (primary, no API key needed)
```
https://www.aemet.es/xml/playas/play_v2_{codigo}.xml
```

### Public HTML (fallback, no API key needed)
```
https://www.aemet.es/es/eltiempo/prediccion/playas?l={codigo}
```
IMPORTANT: Use `?l={codigo}`, NOT the slug URL (`/{slug}-{codigo}`). Slugs for beaches with accents/dashes are unpredictable.

### OpenData API (fallback, requires API key)
```
https://opendata.aemet.es/opendata/api/prediccion/especifica/playa/{codigo}
```
Two-step response: first returns a data URL, then you download the actual JSON.

## Static data

`data/beaches.json` — 20 Cantabria beaches with:
- `codigo`: AEMET ID (e.g. "3902401"). Primary key for all AEMET APIs.
- `nombre`: name aligned with AEMET web (no unnecessary accents, no trailing spaces).
- `municipio`: municipality per AEMET.
- `lat`, `lon`: coordinates verified against AEMET.
- `idCruzRoja`: Red Cross scraper ID (0 = no coverage).
- `webcam` (optional): beach webcam, shown on the detail page. Editorial static data.

### Webcams

Optional `webcam` object per beach in `data/beaches.json` (propagated through `Beach` →
`LegacyDetailsDTO` like `atributos`):

```jsonc
"webcam": {
  "url": "https://...",        // public provider page (or YouTube watch URL)
  "cobertura": "exacta",       // "exacta" | "compartida" | "cercana"
  "estado": "activa"           // optional; "desactivada" hides it without deleting
}
```

- **Never embedded** — the frontend only renders an external link (`Abrir webcam`, opens in a new
  tab). Do not assume providers (Skyline, Hispacams, Camaramar, YouTube, municipal sites) allow iframe.
- `cobertura` drives the honest label: `exacta` → "Webcam en directo", `compartida` → "Vista
  panorámica de la zona", `cercana` → "Webcam cercana". Never present a shared/nearby cam as exact.
- **Add / change**: edit the beach's `webcam` object. **Disable** without losing it:
  `"estado": "desactivada"`. **Remove**: delete the `webcam` key (the section auto-hides).
- Beaches with no reliable cam simply omit `webcam`.


## Encoding and scraping

- AEMET serves HTML/XML in charset **ISO-8859-15**. Always use `responseType: 'arraybuffer'` and decode with `iconv-lite`.
- Scraping User-Agent: use a browser UA, not the axios default.
- AEMET Cache-Control: `max-age=300`. Our cache TTL is aligned at 300s.
- Cheerio is in package.json: use `{ xmlMode: true }` for XML, normal mode for HTML.

## Response shape for /api/beaches/:id/details

```typescript
{
  nombre: string;
  municipio: string;
  codigo: string;
  clima: { ... } | null;              // ALWAYS present if any source works (backward compatible)
  cruzRoja: { ... } | null;           // Red Cross flag data
  prediccionCompleta: { ... } | null; // ONLY when AemetBeachWebScraper succeeded (additive field)
}
```

`clima` is populated from the best available source (scraper → AEMET API → OpenWeather). Existing clients that only read `clima` keep working. `prediccionCompleta` has the enriched data (3 days, morning/afternoon, tides, warnings).

## Config

Environment variables (or `.env`):
- `PORT` (default 4000)
- `CORS_ORIGIN` (default *)
- `AEMET_API_KEY` — for OpenData API (fallback layer 2)
- `OPENWEATHER_API_KEY` — for OpenWeather (fallback layer 3)
- `CACHE_TTL_SECONDS` (default 1800) — TTL BASE de proveedores; se multiplica por `ttlFactor()`
  (×1 en franja de playa de temporada, ×4 el resto del día, ×12 fuera de temporada). Bajarlo a 300
  multiplicaría por 6 el consumo y rompería la cuota diaria de Open-Meteo.
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — opcionales. Si están, la caché pasa a ser
  de dos niveles (`TieredCache`) y sobrevive al dormido y a los despliegues de Render free.
- `SKY_CORRECTION` — corrector de cielo por insolación observada de AEMET (`inso`).
  `on` por defecto: corrige el cielo a peor cuando las estaciones no ven sol y el modelo
  dice despejado. `shadow` calcula y cuenta en `/api/_diag/sky` sin tocar la respuesta;
  `off` lo desactiva. Solo actúa en franja de playa. Usa el mismo valor en CI que en el
  servidor, o el primer `/featured` tras arrancar sale del snapshot sin corregir.
- `DEBUG_WEATHER=1` — enables detailed logs from all providers

## Cuota y diagnóstico

`GET /api/_diag/metrics` expone el consumo real: peticiones salientes por host (desde el arranque,
última hora y último día), concurrencia y enfriamientos por 429, aciertos/fallos de caché por familia
de clave y RSS. Es la única forma fiable de saber a qué distancia se está de los límites gratuitos
(OpenWeather 60/min y 1M/mes, Open-Meteo 10k/día).

Referencias medidas en local con 46 playas y caché fría: un `/details` completo cuesta **2 llamadas a
OpenWeather** (antes 6) y un `/featured` completo ~132 peticiones salientes. Con `data/snapshot.json`
sembrado, el primer `/featured` tras arrancar cuesta **0 peticiones** y responde en decenas de ms.

## Rules for Claude Code

- **New code and comments in English.** Existing Spanish comments stay — do not translate them opportunistically; they carry operational history (dated incidents, provider quirks).
- **No region hardcoding.** Bboxes, catalog paths, forbidden-beach rules and flag operators live in root `regions/<id>/`. HTTP builds one container per validated registry entry; scripts and tests resolve their target explicitly and pass its `RegionConfig` into DI. There is deliberately no `activeRegion` fallback.
- **Never delete existing providers.** Add new ones, don't replace.
- **Never change HTTP endpoint signatures.** Existing response fields are backward compatible.
- **Defensive parsing**: every field from external APIs can be null. Never assume a field exists.
- **Cache everything**: never make an uncached external request, y elige el TTL según la
  naturaleza del dato:
  - **AHORA** (observación actual, precipitación en curso) →
    `Config.providerTtlSeconds()` / `providerStaleTtlSeconds()`. Corto a propósito: manda la
    frescura del "¿está lloviendo?".
  - **PREVISIÓN** (forecast de OpenWeather, playas de AEMET, scraper web) →
    `Config.forecastTtlSeconds()` / `forecastStaleTtlSeconds()`. AEMET publica la previsión de
    playa un par de veces al día; pedirla al ritmo del nowcast gastaba ~6.500 llamadas diarias
    para recibir los mismos bytes.

  Siempre con `getOrSetStale`: la ventana stale hace que una caída del proveedor sirva el último
  valor bueno en vez de `null`. Ambos TTL se escalan solos con `ttlFactor()` (hora y temporada).
- **One payload, one call**: before adding a provider method, check whether an existing cache key
  already holds that payload. The three OpenWeather methods that each re-fetched `/data/2.5/forecast`
  cost 3× the quota for the same bytes; they now share `getForecastRaw()`.
- **Encoding**: when downloading from aemet.es, always use `responseType: 'arraybuffer'` + `iconv-lite`.
- **Type-check**: run `npx tsc --noEmit` after every change to verify types.
- **Logging**: use `debugLog()` from `infrastructure/utils/debug.ts`, not direct console.log (except for critical process errors).

## Backend Skills

When working on the backend, consult the relevant skills from `.agents/skills/` based on the task:
- **nodejs-backend-patterns** — Express middleware, error handling, API patterns
- **nodejs-best-practices** — Node.js architecture decisions, async, security
- **typescript-advanced-types** — advanced TypeScript types

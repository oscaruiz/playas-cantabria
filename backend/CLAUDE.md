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
RedCrossFlagProvider → HTML scraping from cruzroja.es (independent, always runs in parallel)
```

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
- `CACHE_TTL_SECONDS` (default 300)
- `DEBUG_WEATHER=1` — enables detailed logs from all providers

## Rules for Claude Code

- **Never delete existing providers.** Add new ones, don't replace.
- **Never change HTTP endpoint signatures.** Existing response fields are backward compatible.
- **Defensive parsing**: every field from external APIs can be null. Never assume a field exists.
- **Cache everything**: always use `cache.getOrSet()` for external calls. Never make uncached requests.
- **Encoding**: when downloading from aemet.es, always use `responseType: 'arraybuffer'` + `iconv-lite`.
- **Type-check**: run `npx tsc --noEmit` after every change to verify types.
- **Logging**: use `debugLog()` from `infrastructure/utils/debug.ts`, not direct console.log (except for critical process errors).

## Backend Skills

When working on the backend, consult the relevant skills from `.agents/skills/` based on the task:
- **nodejs-backend-patterns** — Express middleware, error handling, API patterns
- **nodejs-best-practices** — Node.js architecture decisions, async, security
- **typescript-advanced-types** — advanced TypeScript types
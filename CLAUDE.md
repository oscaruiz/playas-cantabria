# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Playas Cantabria is a beach information app for Cantabria, Spain. It displays beach listings with real-time weather (AEMET, OpenWeatherMap) and flag/safety data (Cruz Roja). The UI text is Spanish, and the public API keys are Spanish (frontend contract — never rename them).

**Language convention**: NEW code and comments are written in English. Existing Spanish comments and identifiers stay as they are — do not translate them opportunistically; they often carry operational history.

## Repository Structure

This is a monorepo with two independent packages:

- **`backend/`** — Express + TypeScript API server (hexagonal architecture)
- **`frontend/`** — Ionic React + Capacitor mobile/web app

Each has its own `package.json`, `node_modules`, and tsconfig. There is no root-level package manager workspace.

## Commands

### Backend (`cd backend`)

| Task | Command |
|------|---------|
| Dev server (hot reload) | `npm run dev` (uses tsx watch) |
| Build | `npm run build` (tsc, outputs to `dist/`) |
| Start production | `npm start` |
| Tests | `npm test` (vitest) |
| Lint | Use eslint config in `config/.eslintrc.cjs` |

TypeScript config for build is at `backend/config/tsconfig.json` (rootDir=`../src`, outDir=`../dist`).

### Frontend (`cd frontend`)

| Task | Command |
|------|---------|
| Dev server | `npm start` (react-scripts) |
| Build | `npm run build` (Cantabria) |
| Build another region | PowerShell: `$env:REACT_APP_REGION='<id>'; npm run build` |
| Tests | `npm test` (always restores Cantabria) |
| Lint | `npm run lint` (eslint on `src/`) |
| Android sync | PowerShell: `$env:REACT_APP_REGION='<id>'; npm run android:sync` |

## Backend Architecture (Hexagonal / Ports & Adapters)

```
backend/src/
  domain/
    entities/       — Beach, Weather, Flag, Tides
    ports/          — Interfaces (BeachRepository, WeatherProvider, FlagProvider, TidesProvider)
    use-cases/      — GetAllBeaches, GetBeachById, GetBeachDetails
  application/
    dtos/           — BeachDTO, BeachDetailsDTO
    mappers/        — BeachMapper, BeachDetailsMapper, LegacyDetailsMapper
    services/       — DetailsAssembler, LegacyDetailsAssembler
    validation/     — Zod schemas for request params
  infrastructure/
    di/             — DIContainer + dependency wiring (dependencies.ts)
    express/        — Server setup, routes, middlewares
    providers/      — AEMET, OpenWeather, RedCross implementations
    repositories/   — JsonBeachRepository (reads from JSON file)
    cache/          — InMemoryCache
    config/         — Config loading (env vars + Firebase runtime config, validated with Zod)
  regions/          — Region config (bboxes, catalog rules, data paths, flag operators)
```

Dependencies flow inward: infrastructure -> application -> domain. Domain has no imports from other layers.

DI is manual (no framework) — see `infrastructure/di/dependencies.ts` for the full wiring.

**Regions**: contributed data lives in root `regions/<id>/`. `RegionRegistry` validates every region at startup and the server creates one DI container per valid region. Weather providers and coordinate-based cache entries are shared; catalogs, flag routers and region-dependent cache keys are isolated. Flags are provider-neutral: beaches carry `FlagRef`s (`{ provider, ref }`), use cases depend on the `FlagProvider` port, and `FlagProviderRouter` dispatches to the concrete adapter. The API reports the watching operator per beach (`fuenteBanderas`), and a region with no operator (`flagProviders: []`) is a supported case, not a degraded one — see `backend/CLAUDE.md`.

## API Endpoints

- `GET /api/:region/beaches` — list all beaches in a region
- `GET /api/:region/beaches/:id` — single beach
- `GET /api/:region/beaches/:id/details` — beach with weather + flag data
- `GET /api/:region/beaches/featured` — ranked beach conditions
- `GET /api/beaches...` — deprecated Cantabria aliases kept for installed clients

## Frontend Architecture

Ionic React app with three routes:
- `/` — Home (beach list)
- `/playas/:codigo` — PlayaDetalle (beach detail with weather/flags)
- `/mapa` — MapaPage (Leaflet map)

API base URL configured via `REACT_APP_API_BASE_URL` env var (defaults to production Render URL); calls go to `/api/<region>/...`. The app is region-agnostic: `REACT_APP_REGION=<id> npm run build` generates that region's app, with branding, map centre and catalog copied from root `regions/<id>/` by the `sync-region` prebuild. One Firebase Hosting site per region, one app id per region. The frontend has a fallback mechanism: if the backend doesn't respond within 2.5s, it serves beach data from a local JSON file, then updates when the backend responds.

## Environment Variables

### Backend (`.env`)
- `PORT` — server port (default 4000)
- `AEMET_API_KEY` — AEMET weather API key
- `OPENWEATHER_API_KEY` — OpenWeatherMap API key
- `CORS_ORIGIN` — allowed CORS origin (default `*`)
- `CACHE_TTL_SECONDS` — TTL base de proveedores (default 1800), escalado por `ttlFactor()`
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — opcionales; activan la caché L2 que
  sobrevive al dormido y a los despliegues de Render free

### Frontend
- `REACT_APP_API_BASE_URL` — backend URL override
- `REACT_APP_REGION` — region this build serves (default `cantabria`)

## Deployment

- Backend deploys to Render (`playas-cantabria.onrender.com`), automatically on every push to `main`
- Frontend deploys **from the local machine, never from CI**: `cd frontend && npm run build && firebase deploy --only hosting:<region>` with the developer's own `firebase login` session. One Firebase Hosting site per region (multi-site, project `playas-cantabria-front`), or a Capacitor Android app per `capacitorAppId`. No Firebase credential exists in GitHub, deliberately
- Backend also supports Firebase Functions (auto-detected via env vars)


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
| Build | `npm run build` |
| Tests | `npm test` |
| Lint | `npm run lint` (eslint on `src/`) |
| Android sync | `npx cap sync android` |

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

**Regions**: everything region-specific lives in `backend/src/regions/` (today only Cantabria; `activeRegion` in `regions/index.ts` selects it). Engine code must read region data through `activeRegion`, never hardcode bboxes, catalog paths, or region names. Flags are provider-neutral: beaches carry `FlagRef`s (`{ provider, ref }`), use cases depend on the `FlagProvider` port, and `FlagProviderRouter` (wired in the DI from the region's `flagProviders`) dispatches to the concrete adapter (Cruz Roja today). To add a flag operator: new adapter implementing `FlagProvider`, add its id to `FlagProviderId`, register it in the DI router map.

## API Endpoints

- `GET /api/beaches` — list all beaches
- `GET /api/beaches/:id` — single beach
- `GET /api/beaches/:id/details` — beach with weather + flag data (legacy format)

## Frontend Architecture

Ionic React app with three routes:
- `/` — Home (beach list)
- `/playas/:codigo` — PlayaDetalle (beach detail with weather/flags)
- `/mapa` — MapaPage (Leaflet map)

API base URL configured via `REACT_APP_API_BASE_URL` env var (defaults to production Render URL). The frontend has a fallback mechanism: if the backend doesn't respond within 2.5s, it serves beach data from a local JSON file, then updates when the backend responds.

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

## Deployment

- Backend deploys to Render (`playas-cantabria.onrender.com`)
- Frontend can deploy to Firebase Hosting or as a Capacitor Android app
- Backend also supports Firebase Functions (auto-detected via env vars)


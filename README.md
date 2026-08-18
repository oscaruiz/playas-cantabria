# 🏖️ Playucas.es
*Consulta el estado de las playas de Cantabria en tiempo real: puntuación de condiciones, predicción a 3 días con detalle por mañana y tarde, mareas, índice UV, avisos meteorológicos y estado de la bandera de la Cruz Roja.*

---

[![Version](https://img.shields.io/badge/version-2.1.0-blue)](../../releases)
[![License: PolyForm Shield 1.0.0](https://img.shields.io/badge/License-PolyForm%20Shield%201.0.0-blue.svg)](./LICENSE.md)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-informational)
![Node.js](https://img.shields.io/badge/Node.js-20.x-informational)
![Express](https://img.shields.io/badge/Express-4.x-informational)
![React](https://img.shields.io/badge/React-18-informational)
![Ionic](https://img.shields.io/badge/Ionic-React-informational)
![Capacitor](https://img.shields.io/badge/Capacitor-mobile-informational)

Available languages: **Español** | [English](README.en.md)

## Demo en Producción

Puedes probar la aplicación aquí: **[https://playucas.es/](https://playucas.es/)**

Backend API: `https://playas-cantabria.onrender.com`

> El repositorio, el proyecto de Firebase (`playas-cantabria-front`) y el servicio de Render conservan el nombre histórico `playas-cantabria`; la marca pública es **Playucas.es**.

## Preview

<p align="center">
  <img src="./docs/screenshots/home.png" alt="Portada: la mejor playa para hoy" width="220" />
  <img src="./docs/screenshots/list.png" alt="Listado de playas" width="220" />
  <img src="./docs/screenshots/details.png" alt="Detalle de playa" width="220" />
  <img src="./docs/screenshots/map.png" alt="Mapa interactivo" width="220" />
</p>

## Funcionalidades

* **Portada "la mejor playa para hoy":** ranking automático de las playas del catálogo con puntuación 0–100 según condiciones (cielo, viento, bandera…), con las mejores alternativas y aviso claro de que es una recomendación orientativa.
* **Listado de playas** con búsqueda por nombre o municipio, ordenación A-Z / Z-A, favoritos, resumen de condiciones por playa y tendencia (mejora / empeora).
* **Detalle de la playa:**
  * Predicción a 3 días con selector de día y detalle mañana/tarde: cielo, viento y oleaje.
  * Temperatura máxima, del agua y sensación térmica; índice UV con código de colores; avisos meteorológicos con severidad.
  * Tira horaria de las próximas horas y aviso de lluvia inminente (nowcast).
  * Mareas: horas de pleamar y bajamar, con indicador en tiempo real de si la marea sube o baja.
  * Bandera y vigilancia con su operador (Cruz Roja): estado, cobertura y horario, con fecha de actualización.
  * Botón **Compartir** que genera una tarjeta-imagen con la lectura del día, y botón "Cómo llegar" (Google Maps).
  * Enlace a webcam cuando la playa dispone de una fiable.
* **Mapa interactivo** (Leaflet/OpenStreetMap) con condiciones, banderas izadas y tu ubicación.
* **Páginas de municipios y landings temáticas**, prerenderizadas junto al resto de rutas para SEO (sitemap y canónicas incluidos).
* **PWA instalable** con modo offline parcial: si el backend no responde en 2.5s, el listado se sirve desde un JSON local y se actualiza cuando el servidor contesta.
* **Bilingüe:** interfaz en español e inglés.

## Fuentes de datos

La app agrega información de múltiples fuentes con cadena de fallback:

* **AEMET (scraping XML/HTML):** Predicción enriquecida a 3 días, mareas, avisos y UV real (fuente principal).
* **AEMET OpenData API:** Predicción a 2 días como respaldo.
* **OpenWeatherMap:** Datos meteorológicos, UV estimado y respaldo de la tira horaria.
* **Open-Meteo:** Precipitación horaria para el nowcast de lluvia.
* **Cruz Roja:** Estado de la bandera y servicios de socorrismo (scraping).

Caché en memoria con TTL base configurable (1800s por defecto, escalado por hora del día y temporada), ventana *stale* que sirve el último valor bueno si un proveedor cae, deduplicación *singleflight* y segundo nivel opcional en Upstash Redis.

> **Licencias de los datos:** la licencia de este repositorio cubre únicamente el código. Los datos de AEMET, OpenWeatherMap, Open-Meteo, Cruz Roja y OpenStreetMap pertenecen a sus respectivas fuentes y se rigen por sus propios términos (atribución obligatoria; ODbL en el caso de OpenStreetMap). Quien despliegue este software asume esas obligaciones frente a cada proveedor de datos.

---

## Multi-región

El motor es agnóstico de región: **una región es un directorio de datos** en `regions/<id>/`, con su `region.json` (nombre, marca, centro del mapa, operadores de bandera) y su catálogo `beaches.json`. El backend valida cada región al arrancar y monta su API bajo `/api/<id>/…`; el frontend se construye por región con `REACT_APP_REGION=<id>`, que inyecta marca, mapa y catálogo de esa región. Cantabria es la región de referencia; `regions/asturias/` existe como ejemplo de región contribuida.

---

## Arquitectura del Backend

El backend sigue una **Arquitectura Hexagonal** (Puertos y Adaptadores). Las dependencias siempre apuntan hacia adentro: `infrastructure → application → domain`.

### Capas

1. **`Domain` (Núcleo)**
   * Entidades: `Beach`, `Weather`, `Flag`, `Tides`, `BeachForecast`, `RainNowcast`, `Sunshine`.
   * Puertos (interfaces): `BeachRepository`, `WeatherProvider`, `FlagProvider`, `TidesProvider`.
   * Casos de uso: `GetAllBeaches`, `GetBeachById`, `GetBeachDetails`, `GetFeaturedBeaches` (con `BeachScorer`), `GetRainNowcast`.
   * **Sin dependencias** de otras capas.

2. **`Application` (Orquestación)**
   * DTOs: `BeachDTO`, `BeachDetailsDTO`.
   * Mappers: `BeachMapper`, `BeachDetailsMapper`, `FeaturedBeachMapper`, `LegacyDetailsMapper`.
   * Servicios: `DetailsAssembler` y `LegacyDetailsAssembler` (orquestan la cadena de fallback).
   * Validación: Esquemas Zod para parámetros de ruta.

3. **`Infrastructure` (Exterior)**
   * Express: Servidor, rutas, middlewares (CORS, rate limit, errores).
   * Proveedores: `AemetBeachWebScraper`, `AemetBeachForecastProvider`, `AemetWeatherProvider`, `OpenWeatherWeatherProvider`, `OpenMeteoPrecipitationProvider`, `RedCrossFlagProvider` y `FlagProviderRouter` (despacha por operador de bandera).
   * Repositorio: `JsonBeachRepository` (lee el catálogo JSON de la región).
   * Caché: `InMemoryCache` con TTL y singleflight, con L2 opcional en Upstash Redis.
   * DI: Contenedor manual sin framework (`dependencies.ts`), uno por región válida.

### Cadena de Fallback (detalle de playa)

```
Capa 1: AemetBeachWebScraper         → XML/HTML público de aemet.es (3 días, mañana/tarde, mareas, avisos, UV)
Capa 2: AemetBeachForecastProvider   → OpenData API con API key (2 días)
Capa 3: OpenWeatherWeatherProvider   → OpenWeather API (temp, viento, descripción)
Capa 4: GetBeachDetails              → AEMET observación ↔ OpenWeather (hedged, el primero que responde gana)
```

---

## Pila Tecnológica

### Backend

* **Lenguaje:** [TypeScript](https://www.typescriptlang.org/) v5.5
* **Entorno de Ejecución:** [Node.js](https://nodejs.org/) v20+
* **Framework:** [Express.js](https://expressjs.com/) v4.19
* **Arquitectura:** Hexagonal (Puertos y Adaptadores) con DI manual.
* **Validación:** [Zod](https://zod.dev/)
* **HTTP:** [Axios](https://axios-http.com/)
* **Scraping:** [Cheerio](https://cheerio.js.org/)
* **Codificación:** [iconv-lite](https://github.com/ashtuchkin/iconv-lite) (AEMET sirve ISO-8859-15)
* **Tests:** [Vitest](https://vitest.dev/)
* **Despliegue:** [Render](https://render.com/) (principal), [Firebase Functions](https://firebase.google.com/docs/functions) (alternativo)

### Frontend

* **Framework:** [React](https://reactjs.org/) 18 (Create React App)
* **UI Framework:** [Ionic](https://ionicframework.com/) React
* **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
* **Enrutador:** [React Router](https://reactrouter.com/)
* **Mapas:** [Leaflet](https://leafletjs.com/) / [react-leaflet](https://react-leaflet.js.org/) con OpenStreetMap
* **Plataforma Móvil:** [Capacitor](https://capacitorjs.com/)
* **Tests:** Jest + React Testing Library (suite de caracterización)
* **Despliegue Web:** [Firebase Hosting](https://firebase.google.com/docs/hosting) (un site por región)

---

## Estructura del Proyecto

```
playas-cantabria/
├── regions/                  # Datos por región: region.json + beaches.json
│   ├── cantabria/
│   └── asturias/
├── backend/
│   └── src/
│       ├── domain/           # Entidades, puertos, servicios de dominio, casos de uso
│       ├── application/      # DTOs, mappers, servicios, validación
│       ├── infrastructure/   # Express, proveedores, caché, DI, repositorios, config
│       └── regions/          # Registro y validación de regiones en runtime
├── frontend/
│   └── src/
│       ├── app/              # Entrada, rutas y tema (variables CSS)
│       ├── pages/            # Portada, listado, detalle, mapa, municipios, landings, legal
│       ├── modules/          # compartir (tarjeta), favoritos, instalación PWA
│       ├── shared/           # i18n (es/en), SEO/prerender, config, geo, formato, UI
│       ├── services/         # Cliente API
│       └── data/             # Respaldo local del catálogo (generado en build)
└── docs/                     # Capturas y documentación
```

---

## Cómo Empezar

### Prerrequisitos

* **Node.js** v20+
* **npm** (u otro gestor de paquetes)

### Instalación

```bash
git clone https://github.com/oscaruiz/playas-cantabria.git
cd playas-cantabria

# Backend
cd backend
npm install
cp .env.example .env
# Rellena .env con tus API keys

# Frontend
cd ../frontend
npm install
```

### Ejecución

Necesitas dos terminales:

```bash
# Terminal 1 — Backend (http://localhost:4000)
cd backend
npm run dev

# Terminal 2 — Frontend (http://localhost:3000)
cd frontend
npm start
```

### Tests

```bash
cd backend && npm test    # Vitest
cd frontend && npm test   # Jest + RTL (restaura siempre la región Cantabria)
```

---

## API — Endpoints

La API es multi-región: todas las rutas van bajo `/api/:region/…`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/:region/beaches` | Listado de todas las playas de la región |
| GET | `/api/:region/beaches/featured` | Ranking de condiciones (puntuación por playa) |
| GET | `/api/:region/beaches/:id` | Información básica de una playa |
| GET | `/api/:region/beaches/:id/details` | Detalle completo: predicción 3 días, mareas, bandera, coordenadas |

Las rutas históricas sin región (`/api/beaches…`) se mantienen como alias en desuso de Cantabria para los clientes ya instalados. Todo `/api` está limitado a 60 peticiones/minuto por IP.

### Ejemplos

```bash
# Listado (Cantabria)
curl "http://localhost:4000/api/cantabria/beaches"

# Detalle completo (La Concha de Suances)
curl "http://localhost:4000/api/cantabria/beaches/3908503/details"
```

El endpoint `/details` consolida datos de **AEMET, OpenWeatherMap, Open-Meteo y el operador de banderas** e incluye predicción a 3 días con mañana/tarde, mareas (pleamar/bajamar), índice UV, avisos meteorológicos y coordenadas GPS.

---

## Variables de Entorno

### Backend (`.env`)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `4000` |
| `AEMET_API_KEY` | Clave API de AEMET OpenData | — |
| `OPENWEATHER_API_KEY` | Clave API de OpenWeatherMap | — |
| `CORS_ORIGIN` | Origen CORS permitido | `*` |
| `CACHE_TTL_SECONDS` | TTL base de proveedores en segundos (escalado por hora y temporada) | `1800` |
| `FEATURED_FRESH_TTL_SECONDS` | Tiempo fresco del ranking antes de refrescar en segundo plano | `300` |
| `FEATURED_STALE_TTL_SECONDS` | Máximo tiempo durante el que se puede servir el último ranking válido | `3600` |
| `DETAILS_FRESH_TTL_SECONDS` | Tiempo fresco del detalle consolidado | `60` |
| `DETAILS_STALE_TTL_SECONDS` | Máximo tiempo para servir un detalle previo durante el refresco | `600` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Opcionales; activan la caché de dos niveles que sobrevive a los reinicios | — |
| `DEBUG_WEATHER` | `1` habilita logs detallados de proveedores | — |

### Frontend

| Variable | Descripción | Default |
|----------|-------------|---------|
| `REACT_APP_API_BASE_URL` | URL del backend | `https://playas-cantabria.onrender.com` |
| `REACT_APP_REGION` | Región que sirve este build | `cantabria` |
| `REACT_APP_SITE_ORIGIN` | Origen público del despliegue (canónicas, sitemap, manifest) | — |

---

## Contribuciones

Las contribuciones son bienvenidas. Si tienes ideas, sugerencias o quieres reportar un error, abre un *issue* en este repositorio. Antes de enviar un PR, consulta [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Licencia
Este proyecto se distribuye bajo la licencia [PolyForm Shield 1.0.0](./LICENSE.md). Permite usar, estudiar, modificar, forkear y contribuir al software, y reutilizarlo en proyectos que no compitan con Playucas. No permite ofrecer un producto que compita con Playucas, aunque se ofrezca gratis. Es una licencia *source-available*; no es código abierto según la definición de la OSI.

El nombre, el logo y la identidad visual de "Playucas" no están cubiertos por la licencia del software: consulta [TRADEMARK.md](./TRADEMARK.md).

## Versionado
Este proyecto sigue [Semantic Versioning](https://semver.org/lang/es/).
Actualmente en **v2.1.0**.

## Roadmap

- [x] ~~Incorporar datos de **mareas**~~
- [x] ~~Añadir más playas~~ (46 playas de Cantabria en el catálogo)
- [ ] Mejorar la arquitectura del **frontend** (estado, tipos discriminados, caching)
- [ ] Publicar **OpenAPI/Swagger** de la API
- [ ] Tests E2E básicos (Playwright) para flujos principales

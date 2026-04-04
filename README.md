# 🏖️ Playas de Cantabria
*Consulta el estado de las playas de Cantabria en tiempo real. Esta aplicación proporciona predicción a 3 días con detalle por mañana y tarde, mareas, índice UV, avisos meteorológicos y estado de la bandera de la Cruz Roja.*

---

[![Version](https://img.shields.io/badge/version-2.0.0-blue)](../../releases)
[![License: MIT-NC](https://img.shields.io/badge/License-MIT--NC-yellow.svg)](./LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-informational)
![Node.js](https://img.shields.io/badge/Node.js-20.x-informational)
![Express](https://img.shields.io/badge/Express-4.x-informational)
![React](https://img.shields.io/badge/React-18-informational)
![Ionic](https://img.shields.io/badge/Ionic-React-informational)
![Capacitor](https://img.shields.io/badge/Capacitor-mobile-informational)

Available languages: **Español** | [English](README.en.md)

## Demo en Producción

Puedes probar la aplicación aquí: **[https://playas-cantabria-front.web.app/](https://playas-cantabria-front.web.app/)**

Backend API: `https://playas-cantabria.onrender.com`

## Preview

![Pantallazo List (Home)](./docs/screenshots/list.png)
![Pantallazo Map](./docs/screenshots/map.png)
![Pantallazo Details](./docs/screenshots/details.png)

## Funcionalidades

* **Listado de playas** con búsqueda por nombre o municipio y ordenación A-Z / Z-A.
* **Detalle de la playa** con información completa:
  * Predicción a 3 días con selector de día (Hoy, Mañana, Pasado mañana) y fecha.
  * Detalle mañana/tarde: cielo, viento y oleaje para cada franja del día.
  * Temperatura máxima, del agua y sensación térmica.
  * Índice UV con código de colores por nivel.
  * Avisos meteorológicos con nivel de severidad.
  * Mareas: horas de pleamar y bajamar, con indicador en tiempo real de si la marea sube o baja.
  * Cruz Roja: estado de la bandera, cobertura y horario de vigilancia.
  * Botón "Cómo llegar" que abre Google Maps con direcciones hasta la playa.
* **Mapa interactivo** (Leaflet/OpenStreetMap) con tu ubicación actual y acceso directo al detalle de cada playa.
* **Modo offline parcial:** si el backend no responde en 2.5s, el listado se sirve desde un JSON local y se actualiza cuando el servidor contesta.

## Fuentes de datos

La app agrega información de múltiples fuentes con cadena de fallback:

* **AEMET (scraping XML/HTML):** Predicción enriquecida a 3 días, mareas, avisos y UV real (fuente principal).
* **AEMET OpenData API:** Predicción a 2 días como respaldo.
* **OpenWeatherMap:** Datos meteorológicos, UV estimado y predicción de mañana como último recurso.
* **Cruz Roja:** Estado de la bandera y servicios de socorrismo (scraping).

Caché en memoria con TTL configurable (300s por defecto) y deduplicación singleflight.

---

## Arquitectura del Backend

El backend sigue una **Arquitectura Hexagonal** (Puertos y Adaptadores). Las dependencias siempre apuntan hacia adentro: `infrastructure → application → domain`.

### Capas

1. **`Domain` (Núcleo)**
   * Entidades: `Beach`, `Weather`, `Flag`, `Tides`, `BeachForecast`.
   * Puertos (interfaces): `BeachRepository`, `WeatherProvider`, `FlagProvider`, `TidesProvider`.
   * Casos de uso: `GetAllBeaches`, `GetBeachById`, `GetBeachDetails`.
   * **Sin dependencias** de otras capas.

2. **`Application` (Orquestación)**
   * DTOs: `BeachDTO`, `BeachDetailsDTO`.
   * Mappers: `BeachMapper`, `LegacyDetailsMapper`.
   * Servicios: `LegacyDetailsAssembler` (orquesta la cadena de fallback).
   * Validación: Esquemas Zod para parámetros de ruta.

3. **`Infrastructure` (Exterior)**
   * Express: Servidor, rutas, middlewares.
   * Proveedores: `AemetBeachWebScraper`, `AemetBeachForecastProvider`, `OpenWeatherWeatherProvider`, `RedCrossFlagProvider`.
   * Repositorio: `JsonBeachRepository` (lee de JSON estático).
   * Caché: `InMemoryCache` con TTL y singleflight.
   * DI: Contenedor manual sin framework (`dependencies.ts`).

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
* **HTTP:** [Axios](https://axios-http.com/) v1.7
* **Scraping:** [Cheerio](https://cheerio.js.org/) v1.0
* **Codificación:** [iconv-lite](https://github.com/ashtuchkin/iconv-lite) (AEMET sirve ISO-8859-15)
* **Gestión de Entorno:** [Dotenv](https://github.com/motdotla/dotenv)
* **Logging:** [Winston](https://github.com/winstonjs/winston)
* **Despliegue:** [Render](https://render.com/) (principal), [Firebase Functions](https://firebase.google.com/docs/functions) (alternativo)

### Frontend

* **Framework:** [React](https://reactjs.org/) 18
* **UI Framework:** [Ionic](https://ionicframework.com/) React
* **Lenguaje:** [TypeScript](https://www.typescriptlang.org/)
* **Enrutador:** [React Router](https://reactrouter.com/)
* **Mapas:** [Leaflet](https://leafletjs.com/) / [react-leaflet](https://react-leaflet.js.org/) con OpenStreetMap
* **Plataforma Móvil:** [Capacitor](https://capacitorjs.com/)
* **Despliegue Web:** [Firebase Hosting](https://firebase.google.com/docs/hosting)

---

## Estructura del Proyecto

```
playas-cantabria/
├── backend/
│   └── src/
│       ├── domain/           # Entidades, puertos, casos de uso
│       ├── application/      # DTOs, mappers, servicios, validación
│       └── infrastructure/   # Express, proveedores, caché, DI, repositorios
├── frontend/
│   └── src/
│       ├── pages/            # Home, PlayaDetalle, MapaPage
│       ├── services/         # Cliente API
│       ├── config/           # Configuración URL API
│       ├── data/             # JSON fallback de playas
│       └── theme/            # Variables CSS
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
cp .env.tmp .env
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

# Terminal 2 — Frontend (http://localhost:8100)
cd frontend
npm start
```

---

## API — Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/beaches` | Listado de todas las playas |
| GET | `/api/beaches/:id` | Información básica de una playa |
| GET | `/api/beaches/:id/details` | Detalle completo: predicción 3 días, mareas, Cruz Roja, coordenadas |

### Ejemplos

```bash
# Listado
curl "http://localhost:4000/api/beaches"

# Detalle completo (La Concha de Suances)
curl "http://localhost:4000/api/beaches/3908503/details"
```

El endpoint `/details` consolida datos de **AEMET, OpenWeatherMap y Cruz Roja** e incluye predicción a 3 días con mañana/tarde, mareas (pleamar/bajamar), índice UV, avisos meteorológicos y coordenadas GPS.

---

## Variables de Entorno

### Backend (`.env`)

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del servidor | `4000` |
| `AEMET_API_KEY` | Clave API de AEMET OpenData | — |
| `OPENWEATHER_API_KEY` | Clave API de OpenWeatherMap | — |
| `CORS_ORIGIN` | Origen CORS permitido | `*` |
| `CACHE_TTL_SECONDS` | TTL de la caché en segundos | `300` |
| `DEBUG_WEATHER` | Habilita logs detallados y endpoint debug | — |

### Frontend

| Variable | Descripción | Default |
|----------|-------------|---------|
| `REACT_APP_API_BASE_URL` | URL del backend | `https://playas-cantabria.onrender.com` |

---

## Contribuciones

Las contribuciones son bienvenidas. Si tienes ideas, sugerencias o quieres reportar un error, abre un *issue* en este repositorio.

---

## Licencia
Este proyecto está bajo la licencia MIT No Commercial (MIT + NC).
Consulta el archivo [LICENSE](./LICENSE) para más detalles.

## Versionado
Este proyecto sigue [Semantic Versioning](https://semver.org/lang/es/).
Actualmente en **v2.0.0**.

## Roadmap

- [x] ~~Incorporar datos de **mareas**~~
- [ ] Añadir más playas
- [ ] Mejorar la arquitectura del **frontend** (estado, tipos discriminados, caching)
- [ ] Publicar **OpenAPI/Swagger** de la API
- [ ] Tests E2E básicos (Playwright) para flujos principales

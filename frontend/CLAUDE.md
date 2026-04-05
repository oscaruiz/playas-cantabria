# Frontend — CLAUDE.md

Ionic React + Capacitor PWA para información de playas en Cantabria. Todo el código (variables, comentarios, UI) está en español. Consulta el `CLAUDE.md` raíz para contexto general del monorepo.

## Comandos

| Tarea | Comando |
|-------|---------|
| Dev server | `npm start` (react-scripts, puerto 3000) |
| Build | `npm run build` |
| Tests | `npm test` (Jest + React Testing Library) |
| Lint | `npm run lint` (ESLint sobre `src/`) |
| Android sync | `npx cap sync android` |

## Estructura del Proyecto

```
src/
├── App.tsx                  — Entrada principal, define rutas con IonReactRouter
├── index.tsx                — ReactDOM render + service worker
├── config/
│   └── api.ts               — API_BASE_URL y helper buildApiUrl()
├── services/
│   └── api.ts               — Funciones fetch (getPlayas, getDetallePlaya) + interfaces TS
├── pages/
│   ├── Home.tsx / .css       — Listado de playas con búsqueda y ordenación
│   ├── PlayaDetalle.tsx / .css — Detalle: clima, mareas, banderas, previsión 3 días
│   └── MapaPage.tsx / .css   — Mapa Leaflet con marcadores numerados
├── components/
│   └── ExploreContainer.tsx  — Boilerplate de Ionic (sin uso)
├── data/
│   └── beaches.json          — Datos de playas para fallback local
└── theme/
    └── variables.css         — Variables CSS de Ionic (colores, fuentes, dark mode)
```

## Rutas

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/` | `Home` | Listado con filtro de búsqueda y orden A-Z/Z-A |
| `/playas/:codigo` | `PlayaDetalle` | Detalle con clima, bandera Cruz Roja, mareas |
| `/mapa` | `MapaPage` | Mapa Leaflet con todas las playas |

Enrutamiento: `IonReactRouter` > `IonRouterOutlet` > `Route` (React Router v5).

## Gestión de Estado

Sin store global (no Redux, no Context). Solo hooks de React:
- `useState` para estado local de cada página
- `useEffect` para llamadas API
- `useMemo` / `useCallback` para optimización de renders
- Estado de URL vía React Router (`useParams`, `useHistory`)

## Capa API

**`src/config/api.ts`** — Resuelve `API_BASE_URL` desde `REACT_APP_API_BASE_URL` o usa la URL de producción en Render. Exporta `buildApiUrl(path)`.

**`src/services/api.ts`** — Dos funciones principales:
- `getPlayas(options?)` — Lista de playas. Implementa fallback: si el backend no responde en 2.5s, devuelve datos de `data/beaches.json` y actualiza vía callback `onBackendData` cuando llega la respuesta real.
- `getDetallePlaya(codigo)` — Detalle completo de una playa (clima + Cruz Roja + mareas).

Endpoints consumidos: `GET /api/beaches` y `GET /api/beaches/{codigo}/details`.

## Modelos de Datos

Todas las interfaces están en `src/services/api.ts`:

| Interfaz | Uso |
|----------|-----|
| `Playa` | Datos básicos: nombre, municipio, codigo, lat, lon, idCruzRoja |
| `PlayaDetalle` | Extiende Playa con clima, cruzRoja, prediccionCompleta |
| `DatosClima` | Clima simplificado (fuente, hoy, mañana) |
| `DatosCruzRoja` | Bandera, cobertura, horario |
| `PrediccionCompletaDTO` | Previsión 3 días con mareas y avisos |
| `DiaPrediccionDTO` | Un día: mañana/tarde, temperaturas, UV, avisos |
| `HalfDayDTO` | Medio día: cielo, viento, oleaje |

## Estilos

- **CSS co-localizado**: cada página tiene su `.css` al lado (no CSS Modules, no Tailwind)
- **Variables CSS de Ionic** en `theme/variables.css` para colores y dark mode
- **Paleta**: primario oceánico (`#0a7ea4` light / `#38bdf8` dark), dorado arena (`#d4a853`), fondo crema (`#faf6f1`)
- **Fuentes**: Poppins (texto general), Pacifico (títulos decorativos) — cargadas desde Google Fonts en `public/index.html`
- **Layout**: mobile-first, safe-area insets, cards con border-radius 18-20px, flexbox

## Convenciones

- **Componentes**: PascalCase (`FlagBanner`, `QuickStats`, `TidesSection`)
- **Variables de estado**: camelCase
- **Helpers**: funciones utilitarias definidas inline dentro de los archivos de página (no extraídas a utils/)
- **Idioma**: todo el texto de UI, nombres de variables y comentarios en español
- **Subcomponentes**: `PlayaDetalle.tsx` contiene múltiples componentes internos (`FlagBanner`, `ForecastHero`, `DaySelector`, `TidesSection`, etc.)

## Testing

- **Framework**: Jest vía react-scripts + React Testing Library
- **Setup**: `src/setupTests.ts` (jest-dom matchers + mock de `window.matchMedia`)
- **Transform**: se necesita `transformIgnorePatterns` para paquetes Ionic/Stencil (ya configurado en `package.json`)
- **Cobertura actual**: test básico smoke en `App.test.tsx`

## Despliegue

- **Web**: Firebase Hosting (proyecto `playas-cantabria-front`), configurado en `firebase.json` con SPA rewrites
- **Android**: Capacitor (`capacitor.config.ts`), app ID `com.example.app`, web dir `build`
- **Env vars**: `.env.development` (localhost:4000) y `.env.production` (Render URL)

## Notas Importantes

- El mecanismo de fallback de 2.5s en `getPlayas()` es intencional — el backend en Render tiene cold starts largos
- `ExploreContainer.tsx` es boilerplate de Ionic sin usar; se puede eliminar
- El service worker (PWA) está registrado en `index.tsx` pero inactivo por defecto (`serviceWorkerRegistration.unregister()`)
- Los iconos de clima usan URLs de AEMET (`www.aemet.es/imagenes/png/estado_cielo/`)
- ESLint: `react-in-jsx-scope` desactivado (React 17+ JSX transform)

## Frontend Skills

When working on the frontend, consult the relevant skills from `.agents/skills/` based on the task:
- **accessibility** — WCAG audits, aria attributes, keyboard navigation
- **frontend-design** — visual design, distinctive UI components
- **vercel-composition-patterns** — compound components, React composition
- **vercel-react-best-practices** — React performance, bundle size, data fetching
- **typescript-advanced-types** — advanced TypeScript types

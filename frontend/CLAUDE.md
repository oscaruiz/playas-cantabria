# Frontend — CLAUDE.md

Ionic React + Capacitor PWA para información de playas. Es un motor **agnóstico de región**: el mismo código genera la app de Cantabria o la de cualquier otra región (ver «Build por región»). Los comentarios están en inglés; el texto de UI, las claves de i18n y los nombres de variables siguen en español. Consulta el `CLAUDE.md` raíz para contexto general del monorepo.

## Comandos

| Tarea | Comando |
|-------|---------|
| Dev server | `npm start` (react-scripts, puerto 3000) |
| Build | `npm run build` |
| Build de otra región | PowerShell: `$env:REACT_APP_REGION='asturias'; npm run build` |
| Sincronizar datos de región | `npm run sync-region` |
| Tests | `npm test` (Jest + React Testing Library) |
| Lint | `npm run lint` (ESLint sobre `src/`) |
| Android sync | PowerShell: `$env:REACT_APP_REGION='<id>'; npm run android:sync` |

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

**`src/config/api.ts`** — Resuelve `API_BASE_URL` (el host) desde `REACT_APP_API_BASE_URL` o usa la URL de producción en Render. Exporta `buildApiUrl(path)` y **`buildRegionApiUrl(path)`**, que antepone `/api/<region>`. La app siempre usa la segunda: `/api/beaches` sin región es solo el alias en desuso que mantiene vivos a los clientes ya instalados.

**`src/config/region.ts`** — La región de este build. Único sitio que sabe cuál es.

**`src/services/api.ts`** — Dos funciones principales:
- `getPlayas(options?)` — Lista de playas. Implementa fallback: si el backend no responde en 2.5s, devuelve datos de `data/beaches.json` y actualiza vía callback `onBackendData` cuando llega la respuesta real.
- `getDetallePlaya(codigo)` — Detalle completo de una playa (clima + Cruz Roja + mareas).

Endpoints consumidos: `GET /api/{region}/beaches`, `/{codigo}/details` y `/featured`.

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
- **Idioma**: comentarios (nuevos y existentes) en inglés; texto de UI, claves de i18n y nombres de variables en español. Nunca traduzcas claves ni valores de i18n: son contrato y producto
- **Subcomponentes**: `PlayaDetalle.tsx` contiene múltiples componentes internos (`FlagBanner`, `ForecastHero`, `DaySelector`, `TidesSection`, etc.)

## Testing

- **Framework**: Jest vía react-scripts + React Testing Library
- **Setup**: `src/setupTests.ts` (jest-dom matchers + mock de `window.matchMedia`)
- **Transform**: se necesita `transformIgnorePatterns` para paquetes Ionic/Stencil (ya configurado en `package.json`)
- **Cobertura actual**: suite de caracterización, configuración regional, API, i18n y componentes; `App.test.tsx` conserva el smoke básico.

## Despliegue

- **Web**: Firebase Hosting multi-site dentro del proyecto `playas-cantabria-front` — un target por región en `.firebaserc` y una entrada por target en `firebase.json`. Sin proyecto ni factura adicional. Cantabria se sirve bajo el dominio propio `https://playucas.es` (dominio custom sobre el site `playas-cantabria-front`; DNS en Piensa Solutions).
- **Cómo se despliega**: **desde la máquina local, nunca desde CI** — `npm run build` y `firebase deploy --only hosting:<region>`, con la sesión propia de `firebase login`. En GitHub no hay (ni debe haber) ninguna credencial de Firebase: el CI construye cada región para validarla (`region-build` en `quality.yml`), pero no despliega nada.
- **Android**: Capacitor (`capacitor.config.ts`), `appId` y nombre leídos de la región, web dir `build`. Como `android/` está ignorado, `npm run android:sync` aplica después el `applicationId`, nombre y URL scheme al proyecto nativo local. El nombre pasa por `scripts/android-strings.mjs`: los recursos `<string>` de Android exigen escapar `'`, `"` y `\`, y un apóstrofo suelto **no degrada, rompe la compilación** (L'Escala, L'Ampolla). Aquí no hay JDK para detectarlo, así que lo fija `src/test/androidStrings.test.ts`.
- **Env vars**: `.env.development` (localhost:4000), `.env.production` (Render URL + `REACT_APP_SITE_ORIGIN=https://playucas.es`, el origen público que alimenta canonical/og:url, sitemap, manifest y la tarjeta de compartir; los scripts de build lo leen vía `scripts/lib/site-origin.mjs`) y `REACT_APP_REGION` (por defecto `cantabria`). Al construir OTRA región, vacía el origen (`REACT_APP_SITE_ORIGIN=`) para que no herede el dominio de Cantabria.

## Build por región

`REACT_APP_REGION=<id> npm run build` genera la app de esa región (en PowerShell:
`$env:REACT_APP_REGION='<id>'; npm run build`). El prebuild
`scripts/sync-region.mjs` copia desde la raíz `regions/<id>/` lo que CRA necesita dentro de
`src/` y `public/`:

| Generado | De dónde sale | Para qué |
|---|---|---|
| `src/data/beaches.json` | `regions/<id>/beaches.json` | catálogo de respaldo sin conexión |
| `src/data/region.json` | `regions/<id>/region.json` | nombre, branding y centro del mapa |
| `public/manifest.json` | branding de la región | instalación de la PWA |

Los tres están **versionados**, no ignorados: son el respaldo y el manifiesto. Construir otra
región los reescribe — `npm run sync-region` sin variable devuelve Cantabria.

`npm test` restaura siempre Cantabria antes de la suite, así que la suite no depende de para qué región se construyó por última vez. El CI comprueba
después que coincidan con sus fuentes y construye cada región en un job aislado.

`npm run check-regions` valida los datos de cada región y su hosting, **y separa las dos cosas a
propósito**: unos datos inválidos siempre fallan, porque son del colaborador y él puede
arreglarlos; que falte el target de Firebase solo avisa, porque el sitio de hosting únicamente lo
puede crear quien mantiene el repo, y tumbar por eso un PR de solo datos convertiría en mentira
que «una región es un directorio de datos». Con `--require-hosting` sí falla, y así lo invoca el
workflow de despliegue, que es donde de verdad bloquea.

**Nunca escribas a fuego el nombre de una región, un centro de mapa ni una ruta del API.** El
nombre entra en los textos como `{region}`, que `IdiomaContext` interpola solo; el resto sale de
`src/config/region.ts`.

Los tests leen la región del build en vez de dar por hecho Cantabria (`src/test/apiRoutes.ts`),
y `regionBuild.otraRegion.test.tsx` sustituye el módulo de región por otra distinta: es lo que
detecta que algo siga clavado a Cantabria, porque su `region.json` reproduce exactamente los
valores que antes estaban a fuego.

## Notas Importantes

- El mecanismo de fallback de 2.5s en `getPlayas()` es intencional — el backend en Render tiene cold starts largos
- `ExploreContainer.tsx` es boilerplate de Ionic sin usar; se puede eliminar
- El service worker (PWA) está registrado en `index.tsx` y mantiene bundle y respuestas regionales del API disponibles offline.
- Los iconos de clima usan URLs de AEMET (`www.aemet.es/imagenes/png/estado_cielo/`)
- ESLint: `react-in-jsx-scope` desactivado (React 17+ JSX transform)

## Frontend Skills

When working on the frontend, consult the relevant skills from `.agents/skills/` based on the task:
- **accessibility** — WCAG audits, aria attributes, keyboard navigation
- **frontend-design** — visual design, distinctive UI components
- **vercel-composition-patterns** — compound components, React composition
- **vercel-react-best-practices** — React performance, bundle size, data fetching
- **typescript-advanced-types** — advanced TypeScript types

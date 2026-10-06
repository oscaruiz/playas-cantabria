# Frontend — CLAUDE.md

Ionic React + Capacitor PWA para información de playas. Es un motor **agnóstico de región**: el mismo código genera la app de Cantabria o la de cualquier otra región (ver «Build por región»). El código está en inglés (identificadores, archivos, clases CSS, comentarios y títulos de test); siguen en español el texto de UI, las claves de i18n, los campos del JSON del API, las rutas públicas y las claves de almacenamiento (ver «Convenciones»). Consulta el `CLAUDE.md` raíz para contexto general del monorepo.

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
├── app/App.tsx              — Entrada principal, define rutas con IonReactRouter
├── app/theme/variables.css  — Variables CSS de Ionic (colores, fuentes, dark mode)
├── index.tsx                — ReactDOM render + service worker
├── services/api.ts          — Funciones fetch (getBeaches, getBeachDetail, getFeaturedBeaches) + interfaces TS
├── pages/
│   ├── HomePage.tsx / .css        — Inicio: ranking del día, cercanas, favoritas
│   ├── BeachList.tsx / .css       — Listado con búsqueda y ordenación
│   ├── BeachDetailPage.tsx / .css — Detalle; sus secciones viven en beach-detail/
│   ├── MapPage.tsx / .css         — Mapa Leaflet (el lienzo, en map/MapCanvas.tsx)
│   └── landings/                  — Landings SEO y páginas de municipio
├── components/              — Piezas compartidas (BeachCard, BestTime, ScoreBadge, TrendBadge)
├── features/                — provenance (fuente y frescura), ranking
├── modules/                 — favorites, share, install (cada uno con su index.ts público)
├── shared/                  — config, format, i18n, seo, sky, ui
└── data/beaches.json        — Datos de playas para fallback local (generado)
```

## Rutas

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/` | `HomePage` | Ranking del día, playas cercanas y favoritas |
| `/playas` | `BeachList` | Listado con filtro de búsqueda y orden A-Z/Z-A |
| `/playas/:codigo` | `BeachDetailPage` | Detalle con clima, bandera Cruz Roja, mareas |
| `/mapa` | `MapPage` | Mapa Leaflet con todas las playas |

Las rutas son públicas (SEO, sitemap, rewrites de Firebase, enlaces compartidos) y siguen en
español a propósito; los nombres de parámetro (`:codigo`, `:municipio`) también, porque los lee
`useParams`.

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
- `getBeaches(options?)` — Lista de playas. Implementa fallback: si el backend no responde en 2.5s, devuelve datos de `data/beaches.json` y actualiza vía callback `onBackendData` cuando llega la respuesta real.
- `getBeachDetail(codigo)` — Detalle completo de una playa (clima + Cruz Roja + mareas).

Endpoints consumidos: `GET /api/{region}/beaches`, `/{codigo}/details` y `/featured`.

## Modelos de Datos

Todas las interfaces están en `src/services/api.ts`. Sus **nombres** están en inglés; sus
**campos** reproducen el JSON del backend y siguen en español (`codigo`, `nombre`, `cruzRoja`…):
renombrar un campo rompe el contrato.

| Interfaz | Uso |
|----------|-----|
| `Beach` | Datos básicos: nombre, municipio, codigo, lat, lon, idCruzRoja |
| `BeachDetail` | Extiende Beach con clima, cruzRoja, prediccionCompleta |
| `WeatherData` | Clima simplificado (fuente, hoy, mañana) |
| `RedCrossData` | Bandera, cobertura, horario |
| `FullForecastDTO` | Previsión 3 días con mareas y avisos |
| `ForecastDayDTO` | Un día: mañana/tarde, temperaturas, UV, avisos |
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
- **Idioma**: el código va en inglés: identificadores, archivos y carpetas, clases e ids CSS, variables CSS, comentarios y títulos de test. Siguen en español, porque son contrato o producto:
  - texto de UI y claves y valores de i18n (nunca se traducen);
  - campos del JSON del API y valores que vienen de él (`'Verde'`, `'directo'`; también los sufijos de clase construidos con ellos, como `score-badge--alta` y `trend-badge--mejora`);
  - rutas públicas y slugs de landings;
  - claves y formas de `localStorage` (`app_idioma`, `playas:favoritas`, `playas:ultimoListado` con `{ guardadoEn, playas }`), porque viven en el navegador de cada usuario;
  - el mensaje del service worker (`'API_ACTUALIZADA'`, `datos`) y la caché `api-playas`, porque un SW antiguo puede hablar con una página nueva;
  - los datos JSON de `regions/` y `src/data/`.
- **Subcomponentes**: el detalle está repartido en `pages/beach-detail/` (`FlagBanner`, `ForecastHero`, `DaySelector`, `TidesSection`, etc.)

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
nombre entra en los textos como `{region}`, que `LanguageContext` interpola solo; el resto sale de
`src/config/region.ts`.

Los tests leen la región del build en vez de dar por hecho Cantabria (`src/test/apiRoutes.ts`),
y `regionBuild.otherRegion.test.tsx` sustituye el módulo de región por otra distinta: es lo que
detecta que algo siga clavado a Cantabria, porque su `region.json` reproduce exactamente los
valores que antes estaban a fuego.

## Notas Importantes

- El mecanismo de fallback de 2.5s en `getBeaches()` es intencional — el backend en Render tiene cold starts largos
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

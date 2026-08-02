# Phase 0 — Baseline and Architecture Audit

Date: 2026-08-02 · Branch audited: `main` @ `72d2d6d` · Author: Claude Code

Scope: read-only audit for the beach-discovery plan (`tasks/beach-discovery/plan.md`).
No production code was modified. One environment-only fix was applied to run the
backend tests under WSL (see §7.3).

---

## 1. Current frontend routing and navigation constraints

### 1.1 Routes (App.tsx)

| Route | Page | Notes |
|---|---|---|
| `/` | `HomePage` | Featured/ranked beaches, proximity block |
| `/playas` | `PlayasList` | Full list, search, A-Z / distance sorting |
| `/playas/:codigo` | `PlayaDetalle` | `codigo` = AEMET beach code (e.g. `3908503`) |
| `/mapa` | `MapaPage` | Leaflet map, numbered markers |

Routing stack: `IonReactRouter` → `IonRouterOutlet animated={false}` → React Router
**v5** `<Route exact>` components. There is no 404 route: unknown paths render a blank
outlet (relevant later for slug routes and prerender fallback).

### 1.2 Hard constraints (do not break)

- **No `Suspense`/lazy above the router outlet.** `App.tsx:15-19` documents that
  `IonRouterOutlet` keeps its own view stack and does not tolerate an ancestor
  Suspense unmounting it — navigation breaks with a blank screen. All four pages are
  statically imported *on purpose*; code-splitting is only allowed *inside* a page.
  Consequence: anything added to routes/pages (e.g. an `SeoHead` component) lands in
  the **main bundle**, which is guarded by the 185 kB budget (§5.4).
- **React Router v5 API** (`useHistory`, `useParams`, `component=` props). Any new
  route/redirect work must use v5 idioms (`<Redirect>`, `history.replace`), not v6.
- **Navigation is imperative, not anchor-based.** `BottomNavBar` and the list rows
  navigate with `onClick={() => history.push(...)}` (`PlayasList.tsx:269`,
  `BottomNavBar.tsx:26-44`). There are **no `<a href>` links between pages**, so a
  crawler that does not execute JS cannot discover internal URLs today. Ionic
  components accept `routerLink`, which renders a real anchor — the low-risk fix for
  Phase 4/5 crawlability.
- **`document.title` is owned by `IdiomaContext`** (`IdiomaContext.tsx:59`): it sets a
  single, global, region-interpolated title on mount and language change. Per-route
  titles (Phase 4) must take over ownership deliberately or the two will fight.
- **Capacitor Android** loads the same `build/` output from the app bundle; routes
  exist only client-side there. Any new canonical routes must resolve fully in the
  client with no server help.
- **Deep links on the web** work through the Firebase SPA rewrite
  (`** → /index.html`, `frontend/firebase.json`) plus the service worker's
  `createHandlerBoundToURL(index.html)` for navigations after first visit.
- **Back navigation**: standard history; `IonBackButton` is not used — detail pages
  are reached by push and left by browser/hardware back.

### 1.3 Service worker (affects prerendering)

`src/service-worker.ts` (CRA InjectManifest):
- Precaches the build manifest and serves **all navigations from the precached
  `index.html`** (app-shell pattern). After the first visit, any per-route
  prerendered HTML is bypassed for returning users — fine for SEO (crawlers and
  first visits hit the network), but worth knowing when testing.
- `NetworkFirst` (3 s timeout) for `${REGION_API_PATH}/beaches*` responses; only
  status-200 cached; 24 h expiry.
- New build → `SKIP_WAITING` + one reload (`index.tsx`).
- `index.tsx` uses **`createRoot(...).render(...)`, not `hydrateRoot`**: any
  prerendered DOM inside `#root` is discarded and re-rendered on mount. That avoids
  hydration-mismatch errors entirely (a real risk with Ionic/Stencil web components)
  at the cost of a brief repaint — an acceptable and *safe* default for Phase 5.

---

## 2. Current data models

### 2.1 Frontend (`src/services/api.ts` — single source of interfaces)

| Interface | Endpoint | Purpose |
|---|---|---|
| `Playa` | `GET /api/{region}/beaches` | List item + full static catalog fields |
| `PlayaDetalle` | `GET /api/{region}/beaches/:codigo/details` | Static + `tiempoActual` + `clima` + `cruzRoja` + `prediccionCompleta` + `webcam` |
| `FeaturedBeachesResponse` / `FeaturedBeach` | `GET /api/{region}/beaches/featured` | Ranked conditions, score breakdown, trend (`pronostico`) |
| `DatosClima`, `PrediccionDia` | inside detail | Simplified today/tomorrow forecast |
| `PrediccionCompletaDTO`, `DiaPrediccionDTO`, `HalfDayDTO` | inside detail | 3-day forecast, tides, warnings |
| `TiempoActual`, `LluviaActual`, `LluviaPrevista`, `PrevisionHora` | inside detail | Live observation + rain nowcast + hourly outlook |
| `DatosCruzRoja` | inside detail | Flag, season coverage, schedule, capture time |
| `WebcamPlaya` | list + detail | Editorial webcam link (`cobertura`: exacta/compartida/cercana) |

API access: `getPlayas()` (2.5 s fallback chain: backend → localStorage copy ≤24 h →
bundled `data/beaches.json` → `[]`, never rejects), `getDetallePlaya()` (throws typed
`ErrorDetalle`), `getFeaturedBeaches()`. In-memory client cache 5 min per endpoint.

### 2.2 Backend (authoritative DTOs)

- `application/mappers/LegacyDetailsMapper.ts` → **`LegacyDetailsDTO`** is the real
  `/details` contract (the `BeachDetailsDTO` file is marked deprecated).
- `application/dtos/BeachDTO.ts` → list contract; `FeaturedBeachDTO.ts` → featured.
- Public keys are Spanish and **frozen** (frontend contract; `fuenteBanderas` null vs
  absent is load-bearing — see `LegacyDetailsMapper.ts:132-139`).
- Backward compatibility is a stated rule: response fields are only ever added.

### 2.3 Catalog (`regions/cantabria/beaches.json` — 46 beaches)

Field coverage (count of beaches carrying the field):

| Field | Coverage | Field | Coverage |
|---|---|---|---|
| `nombre`/`municipio`/`codigo`/`lat`/`lon` | 46/46 | `parkingDescripcion` | 22/46 |
| `tipoPlaya` | 45/46 | `bus` | 21/46 |
| `arena` | 45/46 | `hospitalDistancia` | 21/46 |
| `acceso` | 45/46 | `submarinismo` | 21/46 |
| `longitud` | 44/46 | `webcam` | 17/46 |
| `atributos` (10 booleans) | **32/46** | `alias` | 8/46 |
| `cruzRojaStations` | 32/46 | `sectores` | 2/46 |
| `anchura` | 22/46 | `idCruzRoja` | 14/46 (10 > 0) |
| `sinAemet` | 26/46 (synthetic 9x codes) | | |

Within `atributos`, per-key coverage ranges 21–29 of 46. **Absence means "unknown",
not "no"** — critical for Phase 3 filters and Phase 6 landing pages.

---

## 3. Field classification: live / forecast / static / user-derived / unknown

| Field (API name) | Class | Source | Timestamp available? |
|---|---|---|---|
| `tiempoActual.cielo/icono/temperatura/precipitacionMm` | **Live** (observation) | OpenWeather (hedged w/ AEMET obs) | `tiempoActual.timestamp` (ISO) |
| `tiempoActual.lluvia` (estado, mm, ultimaHora) | **Live** (multi-source nowcast) | OpenWeather + AEMET gauge + Open-Meteo (`fuentes[]`) | `lluvia.timestamp` (ISO) |
| `tiempoActual.lluvia.prevista` | **Forecast** (next ~6 h) | Open-Meteo ∪ AEMET text (`fuentes[]`) | `desdeIso` (start, not emission) |
| `tiempoActual.previsionHoras[]` | **Forecast** (hourly) | `previsionHorasFuente` | per-hour `horaIso` |
| `temperaturaActual` | **Live** | best weather source | inherits `clima.timestamp` only |
| `clima.hoy/manana` | **Forecast** | `clima.fuente` ('AEMET' \| 'OpenWeatherMap') | `clima.ultimaActualizacion` |
| `prediccionCompleta.dias[]` (sky, wind, waves, temps, UV, avisos) | **Forecast** (3 days) | `fuente` ('AEMET_XML'/'AEMET_HTML') | `elaboracion` (raw AEMET text) |
| `prediccionCompleta.mareas[]` | **Forecast** (deterministic tide tables) | `fuenteMareas` (credit string) | none (per-day only) |
| `cruzRoja.bandera` | **Live** (scraped flag) | operator in `fuenteBanderas` | `cruzRoja.ultimaActualizacion` (ISO) |
| `cruzRoja.horario`, `coberturaDesde/Hasta` | **Semi-static** (season config, scraped) | Cruz Roja | same capture time |
| `fuenteBanderas` | **Static** (region/operator config) | region `flagProviders` | n/a |
| `bandera` (list), featured `bandera` | **Live** (aggregated) | flag provider | featured `timestamp` (epoch ms) |
| Featured: `puntuacion`, `subpuntuaciones`, `razonRanking`, `motivoBaja`, `topeAplicado` | **Live** (derived from live+forecast) | BeachScorer | response `timestamp` (epoch ms) |
| Featured: `pronostico` (direccion/delta/causa) | **Forecast** (derived) | scorer outlook | response `timestamp` |
| `nombre`, `municipio`, `codigo`, `lat`, `lon`, `alias`, `sectores` | **Static** (catalog) | editorial / AEMET-aligned | n/a |
| `atributos.*`, `longitud`, `anchura`, `tipoPlaya`, `arena`, `acceso`, `parkingDescripcion`, `bus`, `hospitalDistancia`, `submarinismo` | **Static** (catalog, partial coverage) | editorial | n/a |
| `webcam` (url, cobertura, estado) | **Static** link to live external content | editorial | n/a — never claim freshness |
| Distance / "cerca de ti" ordering | **User-derived** | `useUserLocation` (geolocation) | computed client-side |
| Language (`idioma`) | **User-derived** | localStorage / navigator | n/a |
| Missing `atributos` on 14 beaches, absent optional fields | **Unknown** | — | must render as "no data", never as `false` |

Notes:
- "Usual crowding" (Phase 7) has **no field anywhere today** — genuinely new.
- "Family friendly" (Phase 3 filter) has **no direct field**; any definition would be
  derived (e.g. socorrismo + duchas + tipoPlaya Urbana) and must be documented or the
  filter dropped. All other Phase 3 filters map to existing data: `bandera` (live),
  webcam (`webcamDisponible()`), lifeguard (`vigilanciaDisponible()` /
  `operadorVigilancia()` in `beachHelpers.ts` — already handle legacy/fallback
  shapes), `atributos.accesible/parking/surf`, favorites (Phase 2), "recommended
  now" (featured `puntuacion`/`motivoBaja`).

---

## 4. Existing source and timestamp fields (inventory and gaps)

### 4.1 What already exists

| Value | Field | Format | Shown today by |
|---|---|---|---|
| Flag capture time | `cruzRoja.ultimaActualizacion` | ISO string | `FlagBanner` + `CruzRojaCard` via `formatearHaceTiempo()` |
| Flag validity | client-side | — | `estadoBandera()` (`color`/`fueraDeHorario`/`sinDatos`), mirrors backend `flagVigencia.ts`; `ultimaBanderaRegistrada()` clamps to lifeguard-day close |
| Observation time | `tiempoActual.timestamp`, `lluvia.timestamp` | ISO string | **not shown** |
| Simplified forecast issue time | `clima.ultimaActualizacion` | string | **not shown** |
| Full forecast issue time | `prediccionCompleta.elaboracion` | raw AEMET text | `MetadataFooter` (verbatim, untranslated) |
| Weather source | `clima.fuente`, `prediccionCompleta.fuente` | enum string | `PlayaDetalle.tsx:237-239` ("Datos meteorológicos: {fuente}", AEMET_XML/HTML collapsed to "AEMET") |
| Hourly forecast source | `previsionHorasFuente` | credit string | `ProximasHoras` footer |
| Tides source | `fuenteMareas` | credit string | `TidesSection` footer (leading `*` stripped) |
| Rain signal sources | `lluvia.fuentes[]`, `prevista.fuentes[]` | string array | **not shown** |
| Featured snapshot age | `FeaturedBeachesResponse.timestamp` | **epoch ms** | `HomePage.tsx:371` via `formatearHaceTiempo()` |
| Relative time i18n | `tiempo.ahoraMismo/haceMin/haceHoras/haceDias` | i18n keys | translated, both languages |

### 4.2 Gaps (Phase 1 targets)

1. **Mixed timestamp formats**: ISO strings (detail) vs epoch ms (featured, backend
   `WeatherDTO.timestamp`) vs raw prose (`elaboracion`). A presentation model must
   normalize at the boundary.
2. **No absolute, accessible representation**: `formatearHaceTiempo()` renders only
   relative text; nothing exposes `<time dateTime>`/`title` with the absolute value.
3. **Live observation shows no timestamp or source** on screen (`tiempoActual` block).
4. **No stale/fallback indicator** for detail data; list fallback shows a notice
   (`beachListPage.fallbackNotice` test) but values are not marked stale.
5. **`ATTR_CONFIG` labels are hardcoded Spanish** (`beachHelpers.ts:307-319`), outside
   i18n — a pre-existing violation the filter UI (Phase 3) should not inherit.
6. **Static attributes carry no "static info" marker** — the plan's honesty rules
   (never dress static data as live) currently rely on layout alone.
7. `formatearHaceTiempo` uses `Date.now()` at render; there is no shared clock/re-render
   tick, so long-lived screens can show stale relative text.

Reusable building blocks for Phase 1: `formatearHaceTiempo`, `esInfoReciente`,
`estadoBandera`, `ultimaBanderaRegistrada`, `horaLocalMadrid`, `fechaMadrid`,
`claveCoberturaWebcam` (honest webcam labels), the `tiempo.*` i18n keys, and the
per-component source footers listed above.

---

## 5. Test, build, CI and performance-budget setup

### 5.1 Frontend

- Jest via react-scripts + React Testing Library; `transformIgnorePatterns` for
  Ionic/Stencil/Leaflet packages (`package.json`).
- `npm test` first runs `sync-region --region cantabria` so the suite never depends
  on the last-built region. `regionBuild.otraRegion.test.tsx` swaps the region module
  to catch Cantabria hardcoding.
- 33 suites: characterization suite (25 files: pages, API fallback chain, i18n
  switch, flag states, region build), unit tests (`beachHelpers`, `beachRanking`,
  `apiText`, `IdiomaContext`, `regionValidation`, `androidStrings`), `App.test.tsx`
  smoke.
- Lint: ESLint (`npm run lint`), `react-in-jsx-scope` off.

### 5.2 Backend

- Vitest (`npm test`), 35 files under `src/__tests__/`; `npx tsc -p
  config/tsconfig.json --noEmit` for type-checking.

### 5.3 CI (`.github/workflows/quality.yml`)

- Backend job: `npm audit` (high, prod), tests, `validate:regions`, build.
- Frontend job: `check-regions`, lint, tests, **`git diff --exit-code` on committed
  Cantabria artifacts** (`src/data/beaches.json`, `src/data/region.json`,
  `public/manifest.json`, `public/index.html`) — any prerender/SEO work that touches
  `public/index.html` must keep the committed file in sync — then per-region builds
  and `perf:budget`.
- Deploys are manual (`deploy-web.yml`, region matrix; `check-regions
  --require-hosting` gates).

### 5.4 Performance budget

`scripts/check-bundle-size.mjs`: **main bundle ≤ 185 kB gzip** (raised from 180 on
2026-08-02 with ~5 kB real headroom). Routes are deliberately in the initial bundle
(§1.2), so *every phase's UI code counts against this*. The script's own comment sets
the escalation rule: measure with `source-map-explorer` before raising again.

### 5.5 Baseline results (run 2026-08-02, WSL2, Node v24.18.1, npm 11.16.0)

| Check | Command | Result |
|---|---|---|
| Backend tests | `cd backend && npm test` | ✅ 387 passed / 387 (35 files) |
| Backend types | `npx tsc -p config/tsconfig.json --noEmit` | ✅ clean |
| Frontend lint | `npm run lint` | ✅ 0 errors (14 pre-existing `no-non-null-assertion` warnings) |
| Frontend tests | `CI=true npm test -- --watchAll=false` | ✅ 336 passed / 336 (33 suites) |
| Frontend build | `npm run build` | ✅ compiled, `build/` produced |
| Perf budget | `npm run perf:budget` | ✅ **180.35 kB gzip of 185 kB limit** |

### 5.6 Bundle budget headroom

The initial bundle sits at **180.35 kB gzip against the 185 kB limit → 4.65 kB of
real headroom** for all seven phases' main-bundle code (see §7.1.1). Secondary
chunks (largest 4.78 kB) are code-split inside pages and don't count against the
budget, which only measures `main.*.js`.

---

## 6. Safe SEO / prerendering approach (recommendation)

### 6.1 Constraints recap

CRA 5 (webpack, no SSR), React Router v5, Ionic view stack (no Suspense above the
outlet, blank screen if violated), service worker app-shell navigation, Firebase
Hosting SPA rewrite, Capacitor Android shipping the same `build/`, one build per
region, and the project's honesty rule: **static HTML must not claim live data**.

Two Firebase behaviours make prerendering safe *without config changes*: hosting
serves an existing file **before** applying rewrites, and `Cache-Control: no-cache`
is already set for `**` (so replaced HTML propagates on deploy).

### 6.2 Recommended approach

**Phase 4 (metadata): `react-helmet-async` + a deterministic URL/slug module.**

- `SeoHead` rendered *inside* each page (allowed; only wrapping the outlet is not).
- `helmet-async`'s provider wraps `IdiomaProvider`-level tree — it does not unmount
  children, so the §1.2 constraint is respected.
- Title ownership moves from `IdiomaContext.tsx:59` to a default `SeoHead`; the
  context keeps `document.documentElement.lang` only. (Alternative: keep the context
  as fallback and let Helmet win; either way, decide explicitly and test.)
- Slugs: generate once from `nombre`/`municipio` (NFD strip accents — the existing
  `normalizarBusqueda` is the base), **store them in the catalog** (`slug` field,
  additive) rather than deriving at runtime forever — names are AEMET-aligned and
  can change; the slug must not (plan: "Do not use the translated beach name as the
  permanent identity").
- New route `/playas/:municipalitySlug/:beachSlug` added *alongside* `/playas/:codigo`
  (v5: order-sensitive `<Route>` declarations; the 2-segment path does not collide
  with the 1-segment code route). Legacy code URLs resolve and `history.replace` to
  canonical; canonical `<link>` always points at the slug URL.
- Watch out: `PlayasList` row navigation and `MapaPage` popups should become
  `routerLink`/anchor-based so internal links are crawlable (§1.2).
- Sitemap/robots: `scripts/generate-sitemap.mjs` reading `regions/<id>/beaches.json`
  + the same slug module (single canonical-URL generator, per plan). **Unknown to
  resolve first: the canonical public origin per region** (Firebase site domain vs
  custom domain) — must live in region config, not code (no-hardcoding rule).

**Phase 5 (static HTML): deterministic build-time template generation — not Puppeteer.**

Generate `build/playas/<municipio>/<playa>/index.html` (plus `/`, `/playas`,
municipality pages) in a post-build Node script that:

1. Takes the built `index.html` as template (keeps hashed asset references intact).
2. Injects per-route `<title>`, meta description, canonical, OG tags (same metadata
   module as Phase 4).
3. Injects a small server-visible content block (name, municipality, static
   attributes, access/parking info, links to canonical pages) inside `#root` or as a
   sibling `<noscript>`+visible block that the app clears on mount — content the app
   replaces via `createRoot.render` (§1.3), so no hydration risk.
4. Fails the build loudly if a route can't be generated (plan acceptance criterion).

Why not a Puppeteer snapshot (react-snap or custom):
- A snapshot bakes **whatever live data the app fetched at build time** (flags,
  weather, scores) into cached HTML — exactly the "static presented as live" trust
  failure this plan forbids. Stripping it back out of a snapshot is more work than
  templating static facts in.
- react-snap is unmaintained and known to struggle with Stencil/Ionic shadow DOM.
- Headless Chrome in CI + Render cold starts make builds slow and flaky; a
  deterministic generator from `beaches.json` has zero network dependencies.
- The client re-renders from scratch anyway (`createRoot`), so a full-DOM snapshot
  buys almost nothing over a content block + correct metadata.

Keep Puppeteer only as a *verification* tool (optional: crawl the built output and
assert title/description/content presence), not as the generator.

Compatibility checklist for the approach:
- SPA fallback: unknown routes still hit the `**` rewrite → `index.html`. ✅
- Service worker: post-build files are not in `__WB_MANIFEST` (generated after the
  build), navigations keep using the app shell after first load. ✅
- Capacitor: extra HTML files are inert in the APK; client routes resolve as today. ✅
- Multi-region: the generator reads the synced region catalog, so each region build
  emits its own pages. ✅
- CI artifact check (§5.3): generator must not modify `public/index.html`. ✅ (it
  reads `build/index.html`.)

### 6.3 Language handling

Prerendered content and metadata should be Spanish (`lang="es"`, the product's base
language and the region's audience). The client still language-switches after load.
Per-language prerender is out of scope; do not emit `hreflang` until it is.

---

## 7. Risks, unknowns, environment notes

### 7.1 Risks

1. **Bundle budget headroom is ~5 kB** and all route code is in the main bundle.
   `react-helmet-async` (~3–4 kB gzip + `prop-types`) plus Phase 1–3 UI may breach
   185 kB. Mitigations: measure after each phase (`perf:budget` is already in the
   plan's per-phase checklist), lazy-load *inside* pages where possible, consider a
   dependency-free `<SeoHead>` (direct `document.head` management via effect) if
   helmet costs too much — it only needs to serve the SPA side, since prerendered
   heads come from the build-time generator.
2. **Working tree EOL noise**: 268 files currently show as modified with
   equal +/− line counts (CRLF/LF, WSL on `/mnt/d`; `core.autocrlf` unset). Any
   phase commit must stage files explicitly (`git add <paths>`), never `-A`, or it
   will sweep ~60 k phantom line changes. Consider normalizing (`.gitattributes`)
   in a separate, dedicated commit — not mixed into this branch.
3. **Attribute coverage is partial** (§2.3): filters must distinguish
   `false`/absent; landing pages must not publish thin/empty categories (plan
   already requires this). "Family friendly" has no data today.
4. **Slug collisions/stability**: two beaches named "La Arena"-style within one
   municipality would collide; the generator needs a collision check that fails the
   build. Accents/apostrophes must survive slugging (see the Android
   `androidStrings` precedent for apostrophes breaking builds).
5. **Route shadowing**: `/playas/:codigo` vs `/playas/:municipalitySlug/:beachSlug`
   differ in segment count so v5 keeps them distinct, but `/playas/featured`-like
   static words must never become a beach code or slug (backend already has this
   shape of problem: `/beaches/featured` vs `/beaches/:id`).
6. **Title ownership handoff** (§1.2): silent regression risk — cover with a test
   (characterization suite already asserts `document.title` behaviour in i18n tests).
7. **Service worker staleness during rollout**: users on the old SW get one reload
   on update; prerendered pages never affect them, but QA on deployed URLs should
   use hard reload / incognito to see generated HTML.

### 7.2 Unknowns (resolve before the affected phase)

- Canonical public origin per region (needed for canonical URLs + sitemap, Phase 4).
- Whether Ionic's `routerLink` on `IonItem`/`IonCard` fits every navigation site
  (map popups are Leaflet DOM, not Ionic — may need manual anchors).
- Source of a documented "usual crowding" dataset (Phase 7 is blocked on it by
  design).
- Whether the deployed Firebase site serves per-directory `index.html` files with
  the expected precedence for *nested* paths (verify once with a hello-world file
  on the preview channel before building all of Phase 5 on it).

### 7.3 Environment notes (this machine, not the repo)

- Repo lives on `/mnt/d` (Windows drive) under WSL2; `node_modules` were installed
  from Windows. Backend vitest failed to start (`@rollup/rollup-linux-x64-gnu`
  missing — npm optional-deps bug). Fixed for this environment with
  `npm install --no-save @rollup/rollup-linux-x64-gnu@4.62.3 @esbuild/linux-x64@0.25.8`
  in `backend/` (touches `node_modules` only; `package.json`/lock diffs are EOL
  noise only, verified with `git diff --ignore-cr-at-eol`). Windows/PowerShell users
  are unaffected.
- I/O on `/mnt/d` is slow: full frontend suite ~2 min, build several minutes.

---

## 8. Recommended implementation order

The plan's phase order is sound. Recommended refinements:

1. **Phase 1 (provenance)** first, as planned — it creates the presentation model
   (`SourceAndFreshness` etc.) that Phases 5–7 depend on for honest rendering, and it
   normalizes the timestamp-format mess (§4.2) at one boundary.
2. **Phase 2 (favorites)** and **Phase 3 (filters)** as planned; both are pure
   frontend + localStorage; build filter logic on the existing helpers
   (`vigilanciaDisponible`, `webcamDisponible`, `coincidePlaya`) instead of new
   predicates. Fix the `ATTR_CONFIG` i18n gap while touching attribute display.
3. **Phase 4 before 5 and 6** (as planned) — slugs, canonical module and metadata are
   the foundation; resolve the canonical-origin unknown at the start of Phase 4.
   Add the `slug` field to `regions/*/beaches.json` + schema as an additive change.
4. **Phase 5** with the deterministic generator (§6.2); verify Firebase nested-path
   precedence early (§7.2). Add the curl acceptance test against a preview channel
   before deploying.
5. **Phase 6** reuses Phase 3 selectors + Phase 4/5 generators (shared, not
   duplicated arrays — plan requirement).
6. **Phase 7** stays last and stays blocked until a documented source exists.
7. Throughout: watch the 185 kB budget per phase (§7.1.1); stage commits explicitly
   (§7.1.2); every new user-facing string goes through `es.ts`/`en.ts`.

# Phase 5 — Static Rendering for Public Routes

Date: 2026-08-02 · Branch: `feature/beach-discovery`

## Approach: deterministic build-time templates, not Puppeteer

As decided in the Phase 0 audit and reaffirmed in Phase 4:
`scripts/prerender.mjs` runs after `react-scripts build` and, from the built
`index.html` (hashed asset references intact), writes one HTML file per
public route into `build/`. No headless browser, no network, no build-time
snapshot of live data — a cached HTML claiming "today's flag" would be the
exact static-dressed-as-live failure this project forbids.

Routes generated: `/` (root index.html rewritten), `/playas`, `/mapa`, and
every canonical beach URL (46 for Cantabria). Municipality and curated pages
arrive with Phase 6 and will join the same generator.

Each generated page contains:

- **Head**: route-specific `<title>`, meta description, canonical, `og:*`,
  `twitter:card` — absolute URLs only when the public origin is known
  (shared resolution in `scripts/lib/site-origin.mjs`, also used by the
  sitemap generator).
- **Body (inside `#root`)**: server-visible static content — beach name,
  municipality, catalog facts (type, sand, dimensions, access, parking, bus,
  hospital), services from `atributos`, crawlable nav links, and an explicit
  honesty note: *"Información fija de la playa. La bandera, el tiempo y las
  mareas de hoy se cargan al abrir la aplicación."* The home and list pages
  carry link lists to all beaches — the app's onClick navigation is not
  crawlable, so these lists are what lets a crawler discover every beach URL.
- React replaces the block on mount (`createRoot().render()` — replacement,
  not hydration, so there is nothing to mismatch). SPA behaviour after load
  is untouched; unknown routes still fall through Firebase's rewrite to the
  app shell.

## One source for every text and URL

- URLs: `src/seo/beachUrls.js` (Phase 4), same module the app navigates with.
- Titles/descriptions: **moved to `src/seo/metadata.js`** (CJS) —
  `i18n/es.ts` now imports the templates for its `seo.*` keys and the
  prerender script fills the same strings with `rellenar()` (same `{var}`
  syntax as the app's interpolar). A test asserts *identity* (`es['seo.x'] ===
  PLANTILLAS_SEO.x`), so re-declaring a string in es.ts fails the suite.
- Attribute labels (`Servicios: Duchas · Parking…`): shared `ETIQUETAS_ATTR`
  in the same module, also consumed by the `attr.*` keys of es.ts.
- Prerendered content is Spanish (the published language); the app still
  switches language client-side. No `hreflang` (single canonical language).

## Failure behaviour (plan requirement: fail loudly)

`prerender.mjs` exits 1 on: slug collisions or empty slugs; a template
without `<title>` or an empty `#root`; any beach page that fails to
generate; or a generated-routes count differing from 3 + catalog size.
It runs inside `npm run build`, so a failure fails the build.

## Tests (8 new)

- `metadata.test.ts` — interpolation semantics; **identity** between es.ts
  keys and the shared templates (drift guard).
- `prerender.test.ts` — runs the real script against a temp build dir with
  the real synced catalog: per-beach page has title/canonical/static
  content/honesty note; `/playas` links exactly all 46 beaches; the root
  index.html is rewritten; a template without the empty root **fails**.

## Verification (2026-08-02)

| Check | Result |
|---|---|
| `CI=true npm test -- --watchAll=false` | ✅ 406 passed / 406 (43 suites; +7 over Phase 4) |
| `npm run lint` | ✅ 0 errors, 12 warnings (unchanged) |
| `npm run build` (prerender + sitemap) | ✅ `[prerender] 49 rutas`, `[sitemap] 49 URLs`; local check: beach page title + 46 links present |
| `npm run perf:budget` | ✅ 181.76 kB gzip of 185 kB (+0.25 kB — the es.ts template indirection) |

## Deployment note

Nothing to configure: Firebase Hosting serves existing files before the SPA
rewrite, and `Cache-Control: no-cache` on `**` means replaced HTML
propagates on deploy. After the next deploy, the acceptance check is:
`curl https://<site>/playas/suances/la-concha` → title + beach facts in the
HTML. The service worker keeps serving the app shell to returning visitors
(by design); crawlers and first visits get the prerendered files.

# Phase 6 — Municipality and Curated Landing Pages

Date: 2026-08-02 · Branch: `feature/beach-discovery`

## Shared selectors, one source

**`src/seo/landings.js`** (CJS, like `beachUrls.js`/`metadata.js`) defines the
curated categories and the municipality helpers. The React pages, the
prerender script and the sitemap all import it — the plan's "generated from
shared selectors, not duplicated arrays" taken literally: a landing cannot
list different beaches in the app and in the baked HTML.

Selectors read **static catalog data only** and treat absence as unknown:

| Landing | Criterion |
|---|---|
| `/playas-con-webcam` | `webcam` present and not `desactivada` (mirror of `webcamDisponible`) |
| `/playas-accesibles` | `atributos.accesible === true` (absent ≠ false → excluded) |
| `/playas-con-socorrista` | registered post: station `id > 0` or `idCruzRoja > 0` ("0 = no coverage" convention) |
| `/playas-para-surf` | `atributos.surf === true` |

**`/playas-para-familias` deliberately does not exist**: the catalog has no
family-suitability field and deriving one would be undocumented editorial
judgement (audit §3). A test pins its absence.

**Empty categories are never published**: `landingsNoVacias()` gates the
routes' presence in prerender and sitemap; a test pins that all four are
non-empty for the real Cantabria catalog (and `[]` for an empty one).

## Pages

- **`/municipios/:municipio`** (`MunicipioPage`) — the municipality's beaches
  (same slugify as beach URLs), alphabetical, each row linking to its
  canonical page with current conditions when the ranking loaded (never
  inferred). Unknown slug → explanatory message + link to the full list.
- **The four curated landings** (`LandingPlayas`, config-driven — one
  component, no duplicated page code) — heading, short factual intro that
  carries the data-source clarification ("la app no comprueba si emite",
  "información fija de la playa"…), count, beach rows.
- All text through i18n (es sources the shared Spanish texts from
  `landings.js`; en has its own translations). SeoHead per page with
  `seo.tituloMunicipio`/landing intros as meta description.
- Routes added in `App.tsx` as ordinary exact Routes (Ionic view stack
  untouched); rows are the shared `FilaPlaya` with keyboard navigation.

## Prerender + sitemap

`prerender.mjs` now also generates every municipality page and every
non-empty landing (same content rules: static facts, crawlable links,
honesty note; no live claims), and the exact-count guard includes them.
`generate-sitemap.mjs` adds the same routes from the same module.

## Tests (12 new)

- `landings.test.ts` — each predicate incl. unknown-vs-false, the
  0-means-no-coverage convention, families' absence, empty-category gating
  (empty catalog and real catalog), municipality uniqueness/slug roundtrip.
- `landingPages.test.tsx` — municipality page lists only its beaches with its
  own title; unknown municipality explains; webcam landing excludes the
  disabled webcam; socorrista landing follows the catalog criterion (row
  titles only — "Laredo" is also a municipality label).
- `prerender.test.ts` (extended) — municipality and landing files generated
  with the shared texts.

## Verification (2026-08-02)

| Check | Result |
|---|---|
| `CI=true npm test -- --watchAll=false` | ✅ 421 passed / 421 (45 suites; +15 over Phase 5) |
| `npm run lint` | ✅ 0 errors, 12 warnings (unchanged); the CJS modules also lint clean standalone (`eslint-env` declared) |
| `npm run build` (prerender + sitemap) | ✅ `[prerender] 71 rutas` = 3 + 46 playas + 18 municipios + 4 landings; sitemap 71 URLs |
| `npm run perf:budget` | ✅ 183.74 kB gzip of 185 kB (+1.98 kB this phase; 1.26 kB headroom left — next phase must measure first) |

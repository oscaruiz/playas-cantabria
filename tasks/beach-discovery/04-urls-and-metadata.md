# Phase 4 — Stable URLs and Page Metadata

Date: 2026-08-02 · Branch: `feature/beach-discovery` · (Phase 3 intentionally skipped by request; only the favorites filter from Phase 2 exists.)

## The single URL module

**`frontend/src/seo/beachUrls.js`** is the one place slugs exist. It exports
`slugify` (lowercase, NFD accent-stripping — the same technique as
`normalizarBusqueda` —, ñ→n, symbol runs → single dash), `rutaPlaya`
(`/playas/<municipio-slug>/<nombre-slug>`), `encontrarPorSlugs` (URL → beach)
and `detectarColisiones`. Pages, `SeoHead` and the sitemap generator all
import it; no component re-implements slugging.

It is deliberately **CommonJS**: the module is consumed by the CRA/TS app
(TS 4.9, `allowJs`), by Jest, and executed by plain Node 20 in the build
script — CJS is the one dialect all of them load without a duplicate copy or
a transpile step.

**Slug identity and collisions.** Slugs are derived from the catalog's
`nombre`/`municipio`; `codigo` (AEMET id) remains the permanent identity, so
a renamed beach changes its pretty URL but never loses its legacy one. Two
beaches slugging to the same route — or a name slugging to nothing — is a
catalog error: `detectarColisiones` reports it, a test pins the real catalog
clean, and the sitemap generator **fails the build** on it. Nothing
disambiguates silently.

## Routes

- **New canonical**: `/playas/:municipio/:playa` (e.g. `/playas/suances/la-concha`),
  declared alongside the legacy route in `App.tsx` (both `exact`, different
  segment counts — no shadowing, and `IonRouterOutlet` sees ordinary Routes).
- **Legacy kept**: `/playas/:codigo` renders the same page forever.
- Resolution lives in `PlayaDetalle`: slug params are matched against the
  catalog via `getPlayas()` (which never rejects — backend, saved copy or
  bundled JSON), then everything downstream keys on the resolved code.
  Unknown slugs surface the existing error state with cause `HTTP 404`.
- **No client redirect from legacy to canonical.** Both routes serve the page
  and declare the slug URL in `<link rel="canonical">` — that is how old links
  "resolve" for SEO. A `history.replace` would switch Route elements and
  remount the Ionic view stack for zero user benefit; Capacitor navigation is
  untouched.
- Every in-app navigation (list rows, home hero + alternatives, map popups)
  now pushes `rutaPlaya(...)`, so users live on canonical URLs.

## Metadata

**`frontend/src/seo/SeoHead.tsx`** — dependency-free head manager (~0.5 kB;
`react-helmet-async` would have spent kilobytes of a budget with ~3 left).
Each page renders one; tags are upserted so navigation overwrites instead of
accumulating. Sets: `<title>`, `meta description`, `link canonical`,
`og:title/description/url/type`, `twitter:card`.

- Titles/descriptions are i18n keys (`seo.*`, es + en) with `{region}`
  interpolated — nothing region-hardcoded. Detail follows the plan's shape:
  "{nombre}: bandera, tiempo y mareas hoy | Playas {region}".
- **Title ownership moved from `IdiomaContext` to `SeoHead`**: parent effects
  run after child effects, so the provider-level title would have overwritten
  every page title on language switch. `IdiomaContext` keeps
  `documentElement.lang` and persistence. The two frozen `regionBuild` title
  assertions were updated to the new list-page title (their real subject —
  region interpolation, no hardcoding — is preserved).
- Canonical origin: `REACT_APP_SITE_ORIGIN` if the build sets it, else the
  serving origin (`window.location.origin`) — correct while each region is
  served from its own Firebase site.

## sitemap.xml and robots.txt

**`frontend/scripts/generate-sitemap.mjs`**, appended to `npm run build`.
Reads the synced region catalog, requires the same `beachUrls.js`, and writes
`build/sitemap.xml` (`/`, `/playas`, `/mapa`, every canonical beach URL) and
`build/robots.txt` (allow all + sitemap pointer).

- Collisions/empty slugs → **exit 1, build fails loudly** (plan requirement,
  brought forward from Phase 5's criteria).
- Public origin: `REACT_APP_SITE_ORIGIN` → else the region's Firebase site in
  `.firebaserc` (`https://<site>.web.app`) → else **skip with a warning,
  exit 0**: a contributed region with no hosting site serves nothing
  publicly, and failing its data-only build would contradict the
  check-regions philosophy ("a region is a data directory").
- Generated into `build/` only — the committed `public/` artifacts that CI
  verifies are untouched; the files ride along harmlessly in the Android
  webDir.

## Tests (17 new; 2 frozen assertions updated)

- `beachUrls.test.ts` — accents/ñ/apostrophes/collapse/empty slugify cases;
  route composition; slug→beach roundtrip for every fixture beach; unknown
  slugs; collision detection (fabricated) and **the real built catalog has
  zero collisions**.
- `SeoHead.test.tsx` — full tag set incl. canonical/og:url absolute URLs;
  navigation overwrites without accumulating; prop changes re-apply.
- `canonicalRoutes.test.tsx` — slug route resolves to the right `/details`
  request; unknown slug → HTTP 404 state; legacy code route still renders and
  declares the slug canonical.

## Verification (2026-08-02)

| Check | Result |
|---|---|
| `CI=true npm test -- --watchAll=false` | ✅ 397 passed / 397 (41 suites; +17 over Phase 2) |
| `npm run lint` | ✅ 0 errors, 12 warnings (unchanged) |
| `npm run build` (incl. sitemap) | ✅ compiled; `[sitemap] 49 URLs` (3 pages + 46 beaches), robots.txt written |
| `npm run perf:budget` | ✅ **181.30 kB gzip of 185 kB — smaller than before the phase** (181.81) |

### Bundle finding worth keeping

The first build of this phase FAILED the budget at 185.17 kB. `source-map-explorer
--no-border-checks` traced it to `seo/beachUrls.js` weighing 4.9 kB: with
Firefox 70 in browserslist, Babel expands a `\p{M}` regex into ~4 kB of
high-entropy Unicode ranges. Replaced with `[̀-ͯ]` (exactly what NFD
emits for Latin diacritics) in a shared `sinAcentos()` — and
`beachHelpers.normalizarBusqueda`, which had been paying the same tax since
before this branch, now shares it. Net effect: the whole phase (routes, SeoHead,
metadata, i18n) fits in **−0.51 kB**.

## Not done (deliberately)

- No prerendering (Phase 5).
- No municipality pages (Phase 6) — `rutaPlaya` already reserves their slug space.
- `hreflang` not emitted: only one canonical language is published.
- Custom domains: when one exists, set `REACT_APP_SITE_ORIGIN` in the deploy
  workflow; everything downstream (canonical, og:url, sitemap, robots)
  follows it.

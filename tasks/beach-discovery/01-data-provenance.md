# Phase 1 — Data Provenance and Freshness

Date: 2026-08-02 · Branch: `feature/beach-discovery`

## What was built

A reusable provenance layer in `frontend/src/features/provenance/`, wired into the
existing screens without changing their behaviour.

### Model — `procedencia.ts` (pure logic, no React)

- `Procedencia { tipo, fuente, instanteMs }` with `tipo: 'directo' | 'prevision' |
  'estatico' | 'sinDatos'` — the plan's live / forecast / static / unavailable.
- `normalizarInstante()` — the single place where the API's mixed timestamp formats
  (ISO strings in the detail, epoch ms in featured) become epoch ms; anything
  unparseable becomes `null`, never a guess.
- `formatearInstanteAbsoluto()` — absolute instant in **Europe/Madrid**, localized
  per UI language; the accessible counterpart of "hace X min".
- `nombreFuenteMeteo()` — collapses `AEMET_XML`/`AEMET_HTML` to the public name
  "AEMET" (replaces two inline `.replace()` chains).
- Builders `procedenciaObservacion()` / `procedenciaPrevisionHoras()` — read only
  what the API sent; return `null` when there is nothing to credit.

### Components — `SourceAndFreshness.tsx` (the plan's four suggested pieces)

- `FreshnessLabel` — the translated relative text (existing `tiempo.*` keys via
  `formatearHaceTiempo`) rendered as a real `<time>` element whose `dateTime`,
  `aria-label` and `title` carry the absolute instant. Renders nothing for a
  missing/unparseable instant.
- `DataSourceLabel` — "Datos meteorológicos: {fuente}" (or any template key).
- `DataStatus` — muted nature marker for non-live values (static info, external
  webcam), visible without being alarming.
- `SourceAndFreshness` — source · freshness composed; each half disappears
  independently when its data is missing.

### New i18n keys (both languages)

`datos.enDirectoFuente`, `datos.estatico`, `datos.webcamExterna`.

## Where it shows

| Screen | Change |
|---|---|
| `ForecastHero` (detail) | **New**: the live observation now credits its provider and capture time — "Observación en directo de OpenWeather · actualizado hace 12 min". Previously this block showed no source or timestamp at all. Only rendered for today (when `tiempoActual` exists). |
| `FlagBanner`, `CruzRojaCard` | Same visible text ("Actualizado hace X"), now an accessible `<time>` with the absolute capture instant. Unparseable ISO now renders nothing instead of an empty line. |
| `ProximasHoras` | Same visible footer, rendered through the shared component. No emission timestamp is shown because the API sends none. |
| `HomePage` hero badge | Same visible "🕒 actualizado hace X", now an accessible `<time>`; the epoch-ms timestamp is normalized by the model instead of formatted inline. |
| `BeachInfoSection`, `BeachAttributesSection` | Static-information marker: "Información fija de la playa, no cambia a diario". |
| `WebcamCard` | External-service marker: "Servicio externo: la app no comprueba si emite" — the link is editorial data; liveness is not claimed. |
| `PlayaDetalle` footer | Unchanged text, source name now normalized by `nombreFuenteMeteo()`. |

## Decisions and non-goals

- **No invented timestamps or sources.** Tides and the hourly outlook carry a
  source but no emission time → only the source is shown.
  `prediccionCompleta.elaboracion` is raw AEMET prose → still shown verbatim in
  `MetadataFooter`, never parsed into a fake timestamp.
- **No global update time.** Each value keeps its own instant (flag capture vs
  observation vs featured snapshot); nothing was merged.
- **No new staleness thresholds.** The flag already has validity rules
  (`estadoBandera`, 24 h/36 h); for everything else the honest signal is the
  now-accessible timestamp itself ("actualizado hace 5h" on a live value speaks
  for itself). Inventing per-source cutoffs would be guesswork — left for a later
  phase if real thresholds are documented.
- **`TidesSection` and `MetadataFooter` untouched**: they already credit their
  sources verbatim and have nothing timestamped to add.
- Phase 2 (favorites) not started.

## Tests

`procedencia.test.ts` (timestamp normalization never invents; Europe/Madrid
absolute formatting in both languages; AEMET name collapse; builders return null
without data) and `SourceAndFreshness.test.tsx` (accessible `<time>` semantics,
translation in es/en, nothing rendered for missing data, ForecastHero wiring) —
22 new tests. Existing characterization suite untouched and passing.

## Verification (2026-08-02)

| Check | Result |
|---|---|
| `CI=true npm test -- --watchAll=false` | ✅ 358 passed / 358 (35 suites; was 336/33 at Phase 0) |
| `npm run lint` | ✅ 0 errors, 12 warnings (Phase 0 baseline was 14 — two old non-null assertions removed by the refactor) |
| `npm run build` | ✅ compiled |
| `npm run perf:budget` | ✅ 180.92 kB gzip of 185 kB (+0.57 kB for the whole phase) |

Note: the ten pre-existing files touched by this phase were normalized from CRLF
back to LF (the index was already LF) so the commit contains only real changes —
see audit §7.1.2 for the working-tree EOL situation.

# Phase 2 — Local Beach Favorites

Date: 2026-08-02 · Branch: `feature/beach-discovery`

## What was built

`frontend/src/features/favorites/` — the three pieces the plan suggested, with
localStorage kept out of page components entirely:

- **`favoritesStorage.ts`** (pure, no React): versioned persistence under the key
  `playas:favoritas` with the plan's format `{ "version": 1, "beachCodes": [...] }`.
  Reading is defensive — garbage JSON, an unknown version, a non-array, or
  non-string entries all degrade to "no favorites", never a crash; entries are
  deduplicated. Writing swallows failures (private mode, full quota), the same
  contract as the existing `guardarPlayas`.
- **`useFavorites.ts`**: one shared in-memory store over the storage layer,
  exposed to React through `useSyncExternalStore`. The star in a list row, the
  detail header and the list filter all read the same set and re-render together;
  no context provider, no prop drilling. `recargarFavoritas()` re-reads storage
  (used by tests; also the hook for an eventual cross-tab `storage` listener).
- **`FavoriteButton.tsx`** + `favorites.css`: a real `<button>` with
  `aria-pressed` and a translated `aria-label` that names the beach
  ("Guardar {nombre} en favoritas" / "Quitar {nombre} de favoritas"). Both
  `click` and Enter/Space `keydown` stop propagation, because the rows it sits
  in navigate on exactly those events. Active color is the theme's sandy gold
  (`--ion-color-secondary`) — saved, not alarmed. Visible focus ring via
  `:focus-visible`.

## Where it shows

| Screen | Change |
|---|---|
| `PlayasList` rows | Star before the chevron on every card. Clicking or keyboard-toggling never opens the beach. |
| `PlayasList` search bar | "Mostrar solo favoritas" toggle (`aria-pressed`), same visual family as the sort buttons. The filter composes with search and both sort orders; the result counter follows it. |
| `PlayasList` empty state | With the filter on, no search term and nothing to show: "Aún no tienes playas favoritas. Toca la estrella de una playa para guardarla aquí." With a search term, the existing "no results for X" text stays, because that is what is actually happening. |
| `PlayaDetalle` header | Star between the title and the language selector once the beach loads. |

New i18n keys (both languages): `fav.marcar`, `fav.quitar`, `fav.filtro`, `fav.vacio`.

## Decisions

- **No accounts, no backend**: favorites are a local, per-device set of beach
  codes, as the plan specifies. Codes are the stable identity (names are
  AEMET-aligned and can change — audit §7.1.4).
- A favorite code that no longer exists in the catalog simply never matches a
  row; it is kept in storage (harmless, and the beach may return).
- Only the favorites filter was added — Phase 3's filter set is untouched.
- One test-visible nuance, documented in `favoritesInPages.test.tsx`: inside the
  detail page the star's re-render can land a tick after the click (other
  updates in flight), so the test asserts with `waitFor`. User-visible behavior
  is unchanged.

## Tests (22 new)

- `favoritesStorage.test.ts` — roundtrip and order, dedupe on save and on read,
  empty-list persistence, seven corrupted-storage shapes, non-string entries,
  and `localStorage` itself throwing on read or write.
- `FavoriteButton.test.tsx` — toggle + persistence, survival across
  remount/re-read, corrupted storage at mount, click/Enter/Space not reaching a
  navigating row, translated accessible names.
- `favoritesInPages.test.tsx` — star on real list rows (marking does not
  navigate), filter + counter + composition with search, useful empty state,
  star in the real detail header persisting to storage.

## Verification (2026-08-02)

| Check | Result |
|---|---|
| `CI=true npm test -- --watchAll=false` | ✅ 380 passed / 380 (38 suites; +22 over Phase 1) |
| `npm run lint` | ✅ 0 errors, 12 warnings (unchanged) |
| `npm run build` | ✅ compiled |
| `npm run perf:budget` | ✅ 181.81 kB gzip of 185 kB (+0.89 kB this phase) |

import beaches from '../data/beaches.json';

/**
 * Size of the offline fallback catalog, read from the very artifact the
 * characterization tests assert about (`src/data/beaches.json`, regenerated
 * by `sync-region` from the region's catalog).
 *
 * Derived, not written down: the literal used to be repeated in six test
 * files plus the backend's `beachCatalog.test.ts`, so every beach addition
 * became a seven-file edit — and forgetting one of them turned CI red
 * (19-aug-2026). A count that merely restates the JSON next to it protects
 * nothing; the deliberate, human-owned pin lives ONCE, in the backend's
 * `beachCatalog.test.ts`, next to the per-beach list that says WHICH beaches
 * are expected. Here we only check that the app serves the whole file.
 */
export const LOCAL_CATALOG_SIZE = (beaches as unknown[]).length;

/**
 * The listing counter as rendered, in each language. The wording stays
 * literal on purpose (a regression in the phrasing must still fail); only
 * the number is derived.
 */
export const BEACH_COUNT_ES = `${LOCAL_CATALOG_SIZE} playas`;
export const BEACH_COUNT_EN = `${LOCAL_CATALOG_SIZE} beaches`;

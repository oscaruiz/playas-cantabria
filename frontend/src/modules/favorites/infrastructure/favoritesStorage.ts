/**
 * Persistence of favorite beaches in localStorage — pure functions, no React.
 *
 * The stored shape is versioned ({ version: 1, beachCodes: [...] }) so a
 * future format change can migrate or discard cleanly instead of guessing.
 * Reading is defensive: anything that is not exactly the expected shape
 * (garbage JSON, another version, non-string entries) degrades to "no
 * favorites", never to a crash. Writing can fail (private mode, full quota)
 * and must never break the interaction — same contract as `guardarPlayas`
 * in `services/api.ts`.
 */

const FAVORITES_KEY = 'playas:favoritas';
const CURRENT_VERSION = 1;

interface FavoritesStore {
  version: number;
  beachCodes: string[];
}

/** Deduplicated, order-preserving copy. */
function unique(codes: readonly string[]): string[] {
  return Array.from(new Set(codes));
}

export function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return [];
    const { version, beachCodes } = parsed as Partial<FavoritesStore>;
    if (version !== CURRENT_VERSION || !Array.isArray(beachCodes)) return [];
    return unique(
      beachCodes.filter((c): c is string => typeof c === 'string' && c !== '')
    );
  } catch {
    return [];
  }
}

export function saveFavorites(codes: readonly string[]): void {
  try {
    const store: FavoritesStore = { version: CURRENT_VERSION, beachCodes: unique(codes) };
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(store));
  } catch {
    // no persistence: the favorite lives on in memory for this session
  }
}

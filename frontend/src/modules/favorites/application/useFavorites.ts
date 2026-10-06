import { useSyncExternalStore } from 'react';
import { readFavorites, saveFavorites } from '../infrastructure/favoritesStorage';

/**
 * Shared favorites store: ONE in-memory set backed by localStorage, so the
 * star in a list row, the detail header and the list filter always agree
 * without prop-drilling or a context provider. React components subscribe
 * through `useFavoritas` (useSyncExternalStore); non-React code can call
 * `toggleFavorita` directly.
 */

let codes: ReadonlySet<string> | null = null;
const listeners = new Set<() => void>();

function current(): ReadonlySet<string> {
  if (codes === null) codes = new Set(readFavorites());
  return codes;
}

function emit(): void {
  listeners.forEach((cb) => cb());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function toggleFavorite(code: string): void {
  const next = new Set(current());
  if (!next.delete(code)) next.add(code);
  codes = next;
  saveFavorites(Array.from(next));
  emit();
}

/**
 * Drops the in-memory copy and re-reads storage. For tests, and for an
 * eventual cross-tab `storage` event listener.
 */
export function reloadFavorites(): void {
  codes = null;
  emit();
}

export function useFavoriteCodes(): {
  favorites: ReadonlySet<string>;
  isFavorite: (code: string) => boolean;
  toggleFavorite: (code: string) => void;
} {
  const favorites = useSyncExternalStore(subscribe, current);
  return { favorites, isFavorite: (code) => favorites.has(code), toggleFavorite };
}

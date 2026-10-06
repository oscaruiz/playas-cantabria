import { useSyncExternalStore } from 'react';
import { leerFavoritas, guardarFavoritas } from '../infrastructure/favoritesStorage';

/**
 * Shared favorites store: ONE in-memory set backed by localStorage, so the
 * star in a list row, the detail header and the list filter always agree
 * without prop-drilling or a context provider. React components subscribe
 * through `useFavoritas` (useSyncExternalStore); non-React code can call
 * `toggleFavorita` directly.
 */

let codigos: ReadonlySet<string> | null = null;
const oyentes = new Set<() => void>();

function actual(): ReadonlySet<string> {
  if (codigos === null) codigos = new Set(leerFavoritas());
  return codigos;
}

function emitir(): void {
  oyentes.forEach((cb) => cb());
}

function suscribir(cb: () => void): () => void {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
}

export function toggleFavorita(codigo: string): void {
  const siguiente = new Set(actual());
  if (!siguiente.delete(codigo)) siguiente.add(codigo);
  codigos = siguiente;
  guardarFavoritas(Array.from(siguiente));
  emitir();
}

/**
 * Drops the in-memory copy and re-reads storage. For tests, and for an
 * eventual cross-tab `storage` event listener.
 */
export function recargarFavoritas(): void {
  codigos = null;
  emitir();
}

export function useFavoritas(): {
  favorites: ReadonlySet<string>;
  isFavorite: (codigo: string) => boolean;
  toggleFavorite: (codigo: string) => void;
} {
  const favoritas = useSyncExternalStore(suscribir, actual);
  return { favorites: favoritas, isFavorite: (codigo) => favoritas.has(codigo), toggleFavorite: toggleFavorita };
}

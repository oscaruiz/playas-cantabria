import { useEffect, useRef } from 'react';

/**
 * Runs `revalidar` when the user comes back to the tab after leaving it.
 *
 * No cache TTL can fix a page that was rendered twenty minutes ago and left
 * open: the home page keeps painting the ranking it loaded then, and tapping
 * into a beach shows a fresher sky than the card the user just tapped. The
 * TTLs make the two screens sample the same window; this makes the screen the
 * user is looking at be inside it.
 *
 * It does NOT force a refetch: it calls the loader, which serves its own cache
 * while it is fresh. Coming back every few seconds costs nothing.
 */
export function useRevalidarAlVolver(revalidar: () => void): void {
  // Kept in a ref so a caller passing an inline arrow does not re-subscribe on
  // every render — the listener would be torn down and rebuilt each time.
  const ultimo = useRef(revalidar);
  ultimo.current = revalidar;

  useEffect(() => {
    const alCambiar = () => {
      if (document.visibilityState === 'visible') ultimo.current();
    };
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, []);
}

import {
  FeaturedBeachesResponse,
  RUTA_FEATURED,
  aplicarFeaturedFresco,
} from '../services/api';
import { useRefrescoDelServiceWorker } from './useRefrescoDelServiceWorker';

/**
 * The ranking that the service worker delivered after having already served
 * its stored copy, for every surface that paints a sky.
 *
 * `useRefrescoDelServiceWorker` alone only repainted the page that happened to
 * be mounted. The sky lives in FOUR places — home, map, list and the landings —
 * all reading the same `/featured` through the same module cache, so the fix
 * belongs in one place: this hook refreshes that cache BEFORE handing the data
 * over. Without it the map went on drawing the old sky while the detail of the
 * beach one tap away showed the current one, and going back home re-served the
 * superseded ranking from the cache, undoing the repaint.
 */
export function useFeaturedFresco(alLlegar: (datos: FeaturedBeachesResponse) => void): void {
  useRefrescoDelServiceWorker(({ url, datos }) => {
    if (!url.endsWith(RUTA_FEATURED)) return;
    const fresco = datos as FeaturedBeachesResponse;
    // A body that is not a ranking would poison the cache for every page.
    if (!Array.isArray(fresco.resumenTodas)) return;
    // Paint what ends up in force, not what the message carried: if a request
    // in flight had already delivered a LATER ranking, this body is the one
    // being discarded and repainting it would be the flicker back.
    alLlegar(aplicarFeaturedFresco(fresco));
  });
}

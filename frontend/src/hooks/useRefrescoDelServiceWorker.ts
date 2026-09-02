import { useEffect, useRef } from 'react';

/** Sent by `service-worker.ts` when a real response supersedes a cached one. */
export const MENSAJE_API_ACTUALIZADA = 'API_ACTUALIZADA';

export interface RespuestaFresca {
  /** Full URL of the endpoint, so the caller can ignore the ones it does not paint. */
  url: string;
  /** The body already parsed. Comes IN the message, so nobody has to ask again. */
  datos: unknown;
}

/**
 * Delivers the answer that arrived after the service worker had already served
 * its stored copy.
 *
 * `NetworkFirst` gives up on the network after three seconds and resolves with
 * the cached body — the first visit of the morning always hits that path,
 * because the first `/featured` after the night is a cold recompute on the
 * backend. Nothing used to repaint when the real response landed, so the screen
 * kept last night's sky, night icons included, until the user reloaded by hand.
 *
 * The callback receives the data. It must NOT fetch again: a refetch writes the
 * cache, and writing the cache is exactly what emits this message — that loop
 * was measured at 634 messages in a single session before it was closed.
 *
 * Same shape as `useRevalidarAlVolver`: the callback lives in a ref so an inline
 * arrow does not tear down and rebuild the listener on every render.
 */
export function useRefrescoDelServiceWorker(alLlegar: (fresca: RespuestaFresca) => void): void {
  const ultimo = useRef(alLlegar);
  ultimo.current = alLlegar;

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const alRecibir = (evento: MessageEvent) => {
      const dato = evento.data;
      if (dato?.type !== MENSAJE_API_ACTUALIZADA) return;
      if (typeof dato.url !== 'string' || dato.datos == null) return;
      ultimo.current({ url: dato.url, datos: dato.datos });
    };
    navigator.serviceWorker.addEventListener('message', alRecibir);
    return () => navigator.serviceWorker.removeEventListener('message', alRecibir);
  }, []);
}

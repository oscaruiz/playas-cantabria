import { useEffect, useRef } from 'react';

/** Sent by `service-worker.ts` when a real response supersedes a cached one. */
export const API_UPDATED_MESSAGE = 'API_ACTUALIZADA';

export interface FreshResponse {
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
 * Same shape as `useRevalidateOnReturn`: the callback lives in a ref so an inline
 * arrow does not tear down and rebuild the listener on every render.
 */
export function useServiceWorkerRefresh(onArrive: (fresh: FreshResponse) => void): void {
  const last = useRef(onArrive);
  last.current = onArrive;

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onReceive = (event: MessageEvent) => {
      const datum = event.data;
      if (datum?.type !== API_UPDATED_MESSAGE) return;
      if (typeof datum.url !== 'string' || datum.datos == null) return;
      last.current({ url: datum.url, datos: datum.datos });
    };
    navigator.serviceWorker.addEventListener('message', onReceive);
    return () => navigator.serviceWorker.removeEventListener('message', onReceive);
  }, []);
}

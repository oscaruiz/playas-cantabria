import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import {
  FeaturedBeachesResponse,
  RUTA_FEATURED,
  aplicarFeaturedFresco,
  getFeaturedBeaches,
  leerRankingEnVigor,
  suscribirRanking,
} from '../../services/api';
import { normalizarInstante, UMBRAL_DATOS_VIEJOS_MS } from '../provenance/procedencia';
import { useRefrescoDelServiceWorker } from '../../hooks/useRefrescoDelServiceWorker';
import { useRevalidarAlVolver } from '../../hooks/useRevalidarAlVolver';

/**
 * The ranking in force, for every screen that paints a sky.
 *
 * There are five of them — home, map, list, detail and the landings — and each
 * one used to wire the same three things by hand: the request, the message the
 * service worker sends when the response it gave up on finally lands, and its
 * own copy of the answer. Only the home page also knew what "this is old"
 * means, so the other four painted last night's sky with nothing to say about
 * it, and the rule for how old is too old lived in the page that happened to
 * need it first.
 *
 * All of that is one module now. What a screen sees is the ranking, when it
 * was assembled, whether it is a copy from an earlier visit, and a way to ask
 * again. Everything else — the module cache, the worker's message, revalidating
 * when the tab comes back, the staleness threshold — is behind the seam.
 *
 * The ranking is READ from `services/api`, never copied into this hook: Ionic
 * keeps visited pages mounted, so a copy per screen would let the one that
 * fired the request repaint while the other four kept the sky they had loaded,
 * which is the very split this module exists to prevent.
 */
export interface RankingEnUso {
  /** The ranking currently in force, or null until the first answer lands. */
  ranking: FeaturedBeachesResponse | null;
  /** When the backend ASSEMBLED it (epoch ms), null if it did not say. */
  actualizadoMs: number | null;
  /** The painted ranking is a stored copy, not a reading from now. */
  deVisitaAnterior: boolean;
  /** No answer yet, of any kind. */
  cargando: boolean;
  /** The request failed and there is nothing to paint. */
  error: boolean;
  /** A retry is in flight. */
  reintentando: boolean;
  /** Ask the backend again, ignoring every cached copy. */
  reintentar: () => void;
}

/**
 * Instant of the stale ranking the automatic retry has already been spent on.
 *
 * Module-level and not a ref per screen, because every mounted screen would
 * otherwise spend its own retry on the same old body, and each attempt wakes a
 * sleeping Render instance. Keyed by the instant rather than a plain boolean so
 * that a ranking that is newer but still old — a different body, a different
 * question — gets its own attempt. What the attempt brings back reaches every
 * screen, so whichever one spends it, all of them are served.
 */
let reintentadoPara: number | null = null;

export function useRanking(): RankingEnUso {
  const ranking = useSyncExternalStore(
    suscribirRanking,
    leerRankingEnVigor,
    leerRankingEnVigor,
  );
  const [error, setError] = useState(false);
  const [reintentando, setReintentando] = useState(false);

  // Only guards the two flags above. The ranking needs no such guard — it is
  // shared state and every screen wants it — but a screen the user navigated
  // away from must not be told its own request failed.
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  useEffect(() => {
    getFeaturedBeaches().catch(() => { if (montado.current) setError(true); });
  }, []);

  // The answer the service worker had given up on, arriving late. What gets
  // painted is whatever ends up IN FORCE, not what the message carried: if a
  // request in flight had already delivered a later ranking, this body is the
  // one being discarded. And never a refetch from here — a request writes the
  // cache, and writing the cache is what emits this message.
  useRefrescoDelServiceWorker(({ url, datos }) => {
    if (!url.endsWith(RUTA_FEATURED)) return;
    const fresco = datos as FeaturedBeachesResponse;
    // A body that is not a ranking would poison the cache for every screen.
    if (!Array.isArray(fresco.resumenTodas)) return;
    aplicarFeaturedFresco(fresco);
  });

  // A page left open for twenty minutes keeps painting what it loaded then.
  // This does not force anything: while the module cache is fresh it answers
  // without asking the backend.
  useRevalidarAlVolver(
    useCallback(() => {
      getFeaturedBeaches().catch(() => { /* what is painted still stands */ });
    }, []),
  );

  // `force`: what is painted came from a stored copy, so the module cache holds
  // that same body and a plain call would hand it back without asking anyone.
  const reintentar = useCallback(() => {
    setReintentando(true);
    return getFeaturedBeaches({ force: true })
      .then(() => { if (montado.current) setError(false); })
      // Nothing on failure, on purpose: a failed retry after a failed load
      // leaves the error already standing, and after a successful one what is
      // painted still stands, so there is nothing new to say.
      .catch(() => { /* we carry on with what is already painted */ })
      .finally(() => { if (montado.current) setReintentando(false); });
  }, []);

  const actualizadoMs = ranking ? normalizarInstante(ranking.timestamp) : null;
  const deVisitaAnterior =
    actualizadoMs != null && Date.now() - actualizadoMs > UMBRAL_DATOS_VIEJOS_MS;

  // Crossing the threshold is an event nothing else announces. A ranking that
  // was nine minutes old when the screen opened is old one minute later, and a
  // phone left face-up on the towel renders nothing in between: without this,
  // neither the notice nor the automatic retry would ever happen.
  const [, repintar] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (actualizadoMs == null || deVisitaAnterior) return;
    const falta = UMBRAL_DATOS_VIEJOS_MS - (Date.now() - actualizadoMs);
    const temporizador = setTimeout(repintar, Math.max(falta, 0) + 1000);
    return () => clearTimeout(temporizador);
  }, [actualizadoMs, deVisitaAnterior]);

  // One automatic retry: the response the service worker gave up on may never
  // arrive (backend asleep, bad network, or the same old ranking again), and
  // without this the screen kept that copy until someone reloaded by hand.
  useEffect(() => {
    if (!deVisitaAnterior || actualizadoMs === reintentadoPara) return;
    reintentadoPara = actualizadoMs;
    void reintentar();
  }, [deVisitaAnterior, actualizadoMs, reintentar]);

  return {
    ranking,
    actualizadoMs,
    deVisitaAnterior,
    cargando: ranking == null && !error,
    error,
    reintentando,
    reintentar,
  };
}

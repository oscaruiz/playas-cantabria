import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import {
  FeaturedBeachesResponse,
  FEATURED_ROUTE,
  applyFreshFeatured,
  getFeaturedBeaches,
  readCurrentRanking,
  subscribeRanking,
} from '../../services/api';
import {
  normalizeInstant,
  RANKING_REVALIDATE_AGE_MS,
  STALE_RANKING_THRESHOLD_MS,
} from '../../../../../../Dev/playas-cantabria/frontend/src/features/provenance/provenance';
import { useServiceWorkerRefresh } from '../../../../../../Dev/playas-cantabria/frontend/src/hooks/useServiceWorkerRefresh';
import { useRevalidateOnReturn } from '../../../../../../Dev/playas-cantabria/frontend/src/hooks/useRevalidateOnReturn';

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
export interface RankingInUse {
  /** The ranking currently in force, or null until the first answer lands. */
  ranking: FeaturedBeachesResponse | null;
  /** When the backend ASSEMBLED it (epoch ms), null if it did not say. */
  updatedMs: number | null;
  /**
   * The painted ranking is a stored copy: older than anything `/featured` can
   * still be serving, so it came from the service worker or the snapshot.
   * Nothing the user does retires it — only a real answer does.
   */
  fromPreviousVisit: boolean;
  /** No answer yet, of any kind. */
  loading: boolean;
  /** The request failed and there is nothing to paint. */
  error: boolean;
  /** A retry is in flight. */
  retrying: boolean;
  /** Ask the backend again, ignoring every cached copy. */
  retry: () => void;
}

/**
 * Instant of the ranking the automatic refetch has already been spent on.
 *
 * Module-level and not a ref per screen, because every mounted screen would
 * otherwise spend its own retry on the same old body, and each attempt wakes a
 * sleeping Render instance. Keyed by the instant rather than a plain boolean so
 * that a ranking that is newer but still old — a different body, a different
 * question — gets its own attempt. What the attempt brings back reaches every
 * screen, so whichever one spends it, all of them are served.
 */
let retriedFor: number | null = null;

export function useRanking(): RankingInUse {
  const ranking = useSyncExternalStore(
    subscribeRanking,
    readCurrentRanking,
    readCurrentRanking,
  );
  const [error, setError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Only guards the two flags above. The ranking needs no such guard — it is
  // shared state and every screen wants it — but a screen the user navigated
  // away from must not be told its own request failed.
  const mountedFlag = useRef(true);
  useEffect(() => {
    mountedFlag.current = true;
    return () => { mountedFlag.current = false; };
  }, []);

  useEffect(() => {
    getFeaturedBeaches().catch(() => { if (mountedFlag.current) setError(true); });
  }, []);

  // The answer the service worker had given up on, arriving late. What gets
  // painted is whatever ends up IN FORCE, not what the message carried: if a
  // request in flight had already delivered a later ranking, this body is the
  // one being discarded. And never a refetch from here — a request writes the
  // cache, and writing the cache is what emits this message.
  useServiceWorkerRefresh(({ url, datos: data }) => {
    if (!url.endsWith(FEATURED_ROUTE)) return;
    const fresh = data as FeaturedBeachesResponse;
    // A body that is not a ranking would poison the cache for every screen.
    if (!Array.isArray(fresh.resumenTodas)) return;
    applyFreshFeatured(fresh);
  });

  // A page left open for twenty minutes keeps painting what it loaded then.
  // This does not force anything: while the module cache is fresh it answers
  // without asking the backend.
  useRevalidateOnReturn(
    useCallback(() => {
      getFeaturedBeaches().catch(() => { /* what is painted still stands */ });
    }, []),
  );

  // `force`: what is painted came from a stored copy, so the module cache holds
  // that same body and a plain call would hand it back without asking anyone.
  const retry = useCallback(() => {
    setRetrying(true);
    return getFeaturedBeaches({ force: true })
      .then(() => { if (mountedFlag.current) setError(false); })
      // Nothing on failure, on purpose: a failed retry after a failed load
      // leaves the error already standing, and after a successful one what is
      // painted still stands, so there is nothing new to say.
      .catch(() => { /* we carry on with what is already painted */ })
      .finally(() => { if (mountedFlag.current) setRetrying(false); });
  }, []);

  const updatedMs = ranking ? normalizeInstant(ranking.timestamp) : null;
  const ageMs = updatedMs == null ? null : Date.now() - updatedMs;

  // When to ASK AGAIN and when to TELL THE USER are two different questions, and
  // they were one constant. The notice fired at ten minutes, which the backend
  // answers from its stale window all day long: it lit up on ordinary days and
  // no tap could retire it, because the same body was coming back. Asking again
  // at ten minutes is right — that IS when there is something newer to get.
  const shouldRevalidate = ageMs != null && ageMs > RANKING_REVALIDATE_AGE_MS;
  const fromPreviousVisit = ageMs != null && ageMs > STALE_RANKING_THRESHOLD_MS;

  // Growing old is an event nothing else announces. A ranking that was nine
  // minutes old when the screen opened is due one minute later, and a phone left
  // face-up on the towel renders nothing in between: without this, a screen open
  // and untouched would never refresh at all — there is no polling anywhere.
  const [, repaint] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (updatedMs == null || shouldRevalidate) return;
    // `actualizadoMs` and not the age as a dependency: the age changes on every
    // render, so the wait would start over each time anything else repainted.
    const missing = RANKING_REVALIDATE_AGE_MS - (Date.now() - updatedMs);
    const timer = setTimeout(repaint, Math.max(missing, 0) + 1000);
    return () => clearTimeout(timer);
  }, [updatedMs, shouldRevalidate]);

  // One automatic refetch per ranking: the response the service worker gave up
  // on may never arrive (backend asleep, bad network, or the same old ranking
  // again), and without this the screen kept that copy until someone reloaded by
  // hand. It hangs on `convieneRevalidar` and NOT on the notice: the day the two
  // thresholds were one, raising the notice to something honest would have
  // silently turned this into an hourly refresh.
  useEffect(() => {
    if (!shouldRevalidate || updatedMs === retriedFor) return;
    retriedFor = updatedMs;
    void retry();
  }, [shouldRevalidate, updatedMs, retry]);

  return {
    ranking,
    updatedMs,
    fromPreviousVisit,
    loading: ranking == null && !error,
    error,
    retrying,
    retry,
  };
}

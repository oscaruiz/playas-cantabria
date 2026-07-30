import { InMemoryCache } from './InMemoryCache';
import { L2Store } from './UpstashRedisStore';
import { debugLog } from '../utils/debug';

/**
 * Two-tier cache: memory (L1) + optional remote store (L2).
 *
 * The problem it solves: on Render free the process falls asleep after 15 minutes
 * and every deploy restarts it, so the in-memory cache evaporates and the
 * first user pays the full fan-out to all providers (~200
 * requests) against a 15 s timeout. The L2 survives that.
 *
 * Only the EXPENSIVE keys are persisted (allowlist): the Upstash free plan gives
 * 10k commands/day and the per-coordinates keys of OpenWeather/Open-Meteo, which
 * number in the hundreds, would exhaust it without contributing much.
 *
 * It is a subclass of InMemoryCache so that no provider has to change:
 * it is wired in a single place (dependencies.ts).
 */

/** Key families worth traveling to the L2 (the expensive fan-out ones). */
const PERSISTIBLES = ['featured:', 'details:', 'flag:', 'aemet:obs:'];

export function esPersistible(key: string): boolean {
  return PERSISTIBLES.some((p) => key.startsWith(p));
}

export class TieredCache extends InMemoryCache {
  constructor(
    private readonly l2: L2Store,
    private readonly reloj: () => number = () => Date.now(),
  ) {
    super(reloj);
  }

  async getOrSet<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    if (!esPersistible(key)) return super.getOrSet(key, ttlSeconds, compute);

    await this.sembrarDesdeL2<T>(key, ttlSeconds, ttlSeconds);
    return super.getOrSet(key, ttlSeconds, this.conEscrituraL2(key, ttlSeconds, compute));
  }

  async getOrSetStale<T>(
    key: string,
    freshTtlSeconds: number,
    staleTtlSeconds: number,
    compute: () => Promise<T>,
  ): Promise<T> {
    if (!esPersistible(key)) {
      return super.getOrSetStale(key, freshTtlSeconds, staleTtlSeconds, compute);
    }

    await this.sembrarDesdeL2<T>(key, freshTtlSeconds, staleTtlSeconds);
    return super.getOrSetStale(
      key,
      freshTtlSeconds,
      staleTtlSeconds,
      this.conEscrituraL2(key, staleTtlSeconds, compute),
    );
  }

  /**
   * The L2 is only queried when L1 has NOTHING: that is, on cold start
   * or after a deploy. During the normal life of the process the L2 is not touched, which
   * is what keeps consumption within the free plan.
   *
   * The value is seeded with its REMAINING life, not the full TTL: a piece of data
   * from 20 minutes ago enters as stale (served instantly and refreshed behind),
   * never as freshly fetched.
   */
  private async sembrarDesdeL2<T>(
    key: string,
    freshTtlSeconds: number,
    staleTtlSeconds: number,
  ): Promise<void> {
    if (this.state(key) !== 'miss') return;

    // The L2 is an accelerator, never a dependency: if it fails, we recompute. The
    // current store already swallows its errors, but the contract is guaranteed here
    // so that it does not depend on whatever implementation sits behind.
    let hit: { value: T; at: number } | undefined;
    try {
      hit = await this.l2.get<T>(key);
    } catch (e: any) {
      debugLog('cache.l2.get.fail', { key, error: e?.message });
      return;
    }
    if (!hit) return;

    const edadSeg = (this.reloj() - hit.at) / 1000;
    if (edadSeg >= staleTtlSeconds) return; // too old to serve

    this.seed(
      key,
      hit.value,
      Math.max(0, freshTtlSeconds - edadSeg),
      staleTtlSeconds - edadSeg,
    );
    debugLog('cache.l2.hit', { key, edadSeg: Math.round(edadSeg) });
  }

  /** Write-through: what gets computed is also stored in L2, without waiting. */
  private conEscrituraL2<T>(
    key: string,
    ttlSeconds: number,
    compute: () => Promise<T>,
  ): () => Promise<T> {
    return async () => {
      const value = await compute();
      // The write is not awaited, but its failure IS swallowed: an unhandled
      // rejected promise brings down the Node process. The current store never
      // throws, but the L2 is an extension point and this contract cannot
      // depend on the next implementation remembering that.
      void this.l2.set(key, value, ttlSeconds).catch(() => undefined);
      return value;
    };
  }
}

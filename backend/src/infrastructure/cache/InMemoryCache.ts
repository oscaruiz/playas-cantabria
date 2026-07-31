type CacheRecord<V> = {
  value: V;
  freshUntil: number;
  staleUntil: number;
};

export type CacheState = 'miss' | 'fresh' | 'stale';

export type CacheStats = Record<CacheState, number>;

export class InMemoryCache {
  private store = new Map<string, CacheRecord<unknown>>();
  private inFlight = new Map<string, Promise<unknown>>();
  /**
   * Hits/misses per key family (the prefix up to the first ':').
   * Only counted from getOrSet/getOrSetStale, which are the decisions
   * that determine whether an external provider gets called or not.
   */
  private stats = new Map<string, CacheStats>();
  constructor(private readonly now: () => number = () => Date.now()) {}

  private track(key: string, state: CacheState): void {
    const family = key.slice(0, key.indexOf(':') + 1 || undefined);
    const s = this.stats.get(family) ?? { miss: 0, fresh: 0, stale: 0 };
    s[state]++;
    this.stats.set(family, s);
  }

  /** Snapshot for /api/_diag/metrics. */
  snapshot(): { entradas: number; enVuelo: number; porFamilia: Record<string, CacheStats> } {
    return {
      entradas: this.store.size,
      enVuelo: this.inFlight.size,
      porFamilia: Object.fromEntries(this.stats),
    };
  }

  get<T>(key: string): T | undefined {
    const rec = this.store.get(key);
    if (!rec) return undefined;
    if (rec.freshUntil <= this.now()) {
      if (rec.staleUntil > this.now()) return undefined;
      this.store.delete(key);
      return undefined;
    }
    return rec.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    const expiresAt = this.now() + ttlSeconds * 1000;
    this.store.set(key, { value, freshUntil: expiresAt, staleUntil: expiresAt });
  }

  /**
   * Inserts a value controlling the fresh and stale windows separately.
   * With `freshTtlSeconds = 0` the value enters already as STALE: it is served instantly
   * and triggers a background refresh. This is what allows warm-starting
   * from a snapshot or from the L2 cache without pretending the data is new.
   */
  seed<T>(key: string, value: T, freshTtlSeconds: number, staleTtlSeconds: number): void {
    const now = this.now();
    this.store.set(key, {
      value,
      freshUntil: now + freshTtlSeconds * 1000,
      staleUntil: now + staleTtlSeconds * 1000,
    });
  }

  state(key: string): CacheState {
    const rec = this.store.get(key);
    if (!rec) return 'miss';
    const now = this.now();
    if (rec.freshUntil > now) return 'fresh';
    if (rec.staleUntil > now) return 'stale';
    this.store.delete(key);
    return 'miss';
  }

  /**
   * Get cached value or compute it. Concurrent calls for the same key
   * share a single in-flight promise (singleflight pattern).
   */
  async getOrSet<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const existing = this.get<T>(key);
    this.track(key, existing !== undefined ? 'fresh' : 'miss');
    if (existing !== undefined) return existing;

    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;

    const promise = compute()
      .then((value) => {
        this.set(key, value, ttlSeconds);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise as Promise<T>;
  }

  /**
   * Serve a fresh value normally, serve a stale value immediately while one
   * background refresh runs, and block only when no usable value exists.
   */
  async getOrSetStale<T>(
    key: string,
    freshTtlSeconds: number,
    staleTtlSeconds: number,
    compute: () => Promise<T>,
  ): Promise<T> {
    const rec = this.store.get(key) as CacheRecord<T> | undefined;
    const state = this.state(key);
    this.track(key, state);

    if (state === 'fresh' && rec) return rec.value;

    const startCompute = (): Promise<T> => {
      const pending = this.inFlight.get(key);
      if (pending) return pending as Promise<T>;

      const promise = compute()
        .then((value) => {
          const now = this.now();
          this.store.set(key, {
            value,
            freshUntil: now + freshTtlSeconds * 1000,
            staleUntil: now + staleTtlSeconds * 1000,
          });
          return value;
        })
        .finally(() => {
          this.inFlight.delete(key);
        });

      this.inFlight.set(key, promise);
      return promise;
    };

    if (state === 'stale' && rec) {
      void startCompute().catch(() => undefined);
      return rec.value;
    }

    return startCompute();
  }
}

/**
 * Standardized cache keys used by providers/repository.
 */
export const CacheKeys = {
  beachesAll: (regionId: string) => `beaches:${regionId}:all`,
  beachById: (regionId: string, id: string) => `beach:${regionId}:${id}`,
  weatherByCoords: (lat: number, lon: number, provider: string) =>
    `weather:${provider}:${lat.toFixed(4)},${lon.toFixed(4)}`,
  flagByRedCrossId: (regionId: string, id: number) => `flag:${regionId}:cr:${id}`,
  featuredBeaches: (regionId: string) => `featured:${regionId}:beaches`,
  detailsByBeachId: (regionId: string, id: string) => `details:${regionId}:${id}`,
};

type CacheRecord<V> = { value: V; expiresAt: number };

export class InMemoryCache {
  private store = new Map<string, CacheRecord<unknown>>();
  private inFlight = new Map<string, Promise<unknown>>();
  constructor(private readonly now: () => number = () => Date.now()) {}

  get<T>(key: string): T | undefined {
    const rec = this.store.get(key);
    if (!rec) return undefined;
    if (rec.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return rec.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    const expiresAt = this.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
  }

  /**
   * Get cached value or compute it. Concurrent calls for the same key
   * share a single in-flight promise (singleflight pattern).
   */
  async getOrSet<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const existing = this.get<T>(key);
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
}

/**
 * Standardized cache keys used by providers/repository.
 */
export const CacheKeys = {
  beachesAll: 'beaches:all',
  beachById: (id: string) => `beach:${id}`,
  weatherByCoords: (lat: number, lon: number, provider: string) =>
    `weather:${provider}:${lat.toFixed(4)},${lon.toFixed(4)}`,
  flagByRedCrossId: (id: number) => `flag:cr:${id}`,
  featuredBeaches: 'featured:beaches',
};

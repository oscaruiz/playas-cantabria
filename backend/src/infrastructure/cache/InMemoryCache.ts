type CacheRecord<V> = {
  value: V;
  expiresAt: number; // epoch ms
};

export class InMemoryCache {
  private store = new Map<string, CacheRecord<unknown>>();

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
   * Convenience: get or compute atomically-ish.
   */
  async getOrSet<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    const existing = this.get<T>(key);
    if (existing !== undefined) return existing;
    const value = await compute();
    this.set<T>(key, value, ttlSeconds);
    return value;
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
};

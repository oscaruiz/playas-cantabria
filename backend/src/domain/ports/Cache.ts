/**
 * Port for the cache the use cases memoize through. Only what the domain
 * calls; `InMemoryCache` (and `TieredCache`) satisfy it structurally.
 */
export interface Cache {
  get<T>(key: string): T | undefined;
  /**
   * The value being served for `key`, fresh OR stale, without computing or
   * refreshing anything. For reading what another use case published.
   */
  peek<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlSeconds: number): void;
  /** Cached value or `compute()`; concurrent calls share one in-flight promise. */
  getOrSet<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T>;
  /** Like `getOrSet`, but serves a stale value while one refresh runs. */
  getOrSetStale<T>(
    key: string,
    freshTtlSeconds: number,
    staleTtlSeconds: number,
    compute: () => Promise<T>,
  ): Promise<T>;
}

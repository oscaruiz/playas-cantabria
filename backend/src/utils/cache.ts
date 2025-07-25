type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  updatedAt: number;
};

export class SimpleCache {
  private cache = new Map<string, CacheEntry<any>>();

  constructor(private ttlMs: number) {}

  get<T>(key: string): { value: T; updatedAt: Date } | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return {
      value: entry.value as T,
      updatedAt: new Date(entry.updatedAt),
    };
  }

  set<T>(key: string, value: T) {
    const now = Date.now();
    this.cache.set(key, {
      value,
      expiresAt: now + this.ttlMs,
      updatedAt: now,
    });
  }

  clear() {
    this.cache.clear();
  }
}

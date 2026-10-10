import { currentTicket, inBackground, runWithTicket, Ticket } from '../http/priority';

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
  /** Priority of the in-flight computes that started as background work. */
  private inFlightTickets = new Map<string, Ticket>();
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

    return this.shared(key, compute, (value) => this.set(key, value, ttlSeconds));
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

    const store = (value: T) => {
      const now = this.now();
      this.store.set(key, {
        value,
        freshUntil: now + freshTtlSeconds * 1000,
        staleUntil: now + staleTtlSeconds * 1000,
      });
    };

    if (state === 'stale' && rec) {
      void this.shared(key, compute, store, true).catch(() => undefined);
      return rec.value;
    }

    return this.shared(key, compute, store);
  }

  /**
   * Joins the in-flight compute of `key` or starts it (singleflight).
   *
   * `detached`: nobody waits for the result (the stale refresh), so its outgoing
   * calls yield to the ones a user is waiting on. A compute started from such
   * work inherits that, and a caller that ends up WAITING on one, a miss joining
   * a refresh already in flight, promotes it: otherwise a /details would sit
   * behind the very ranking refresh that happened to be fetching its beach.
   */
  private shared<T>(
    key: string,
    compute: () => Promise<T>,
    store: (value: T) => void,
    detached = false,
  ): Promise<T> {
    const pending = this.inFlight.get(key);
    if (pending) {
      const running = this.inFlightTickets.get(key);
      if (running && !detached) {
        // A user waiting promotes it now; background work waiting on it is
        // recorded, so promoting that work later reaches this compute too.
        const waiter = currentTicket();
        if (waiter) waiter.waitOn(running);
        else running.promote();
      }
      return pending as Promise<T>;
    }

    const ticket = detached
      ? new Ticket()
      : inBackground() ? new Ticket(currentTicket()) : undefined;
    const promise = (ticket ? runWithTicket(ticket, compute) : compute())
      .then((value) => {
        store(value);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
        this.inFlightTickets.delete(key);
      });

    this.inFlight.set(key, promise);
    if (ticket) this.inFlightTickets.set(key, ticket);
    return promise;
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
  /**
   * Sky-correction decision for a beach. The model's icon and whether it is
   * raining are part of the KEY, not of the value: they are the inputs the
   * decision guards on, so a decision taken for one sky must never be reused
   * for a different one.
   */
  skyDecision: (regionId: string, playa: string, icono: string, lloviendo: boolean) =>
    `sky:${regionId}:${playa}:${icono}:${lloviendo ? 'r' : 'x'}`,
};

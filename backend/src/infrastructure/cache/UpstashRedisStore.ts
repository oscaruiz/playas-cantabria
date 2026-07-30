import { http } from '../http/axiosClient';
import { debugLog } from '../utils/debug';

/**
 * L2 store on top of the Upstash Redis REST API (free plan: 10k commands/day).
 *
 * REST is used instead of a Redis client on purpose: zero new dependencies, zero
 * persistent sockets to keep alive in a process that Render puts to sleep every
 * 15 minutes.
 *
 * RULE: this layer NEVER throws or blocks the response. If Upstash is not
 * configured or fails, the app behaves exactly as with memory only.
 */

export interface L2Store {
  get<T>(key: string): Promise<{ value: T; at: number } | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

/** Envelope with a timestamp: without it there is no way to know whether the value is still fresh. */
interface Envelope<T> {
  v: T;
  at: number;
}

const TIMEOUT_MS = 1500;
/** Redis rejects huge values and the free plan charges dearly for them. */
const MAX_BYTES = 400_000;

export class UpstashRedisStore implements L2Store {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Returns the configured store, or undefined if the environment variables are missing. */
  static fromEnv(): UpstashRedisStore | undefined {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return undefined;
    return new UpstashRedisStore(url.replace(/\/$/, ''), token);
  }

  private get auth() {
    return { headers: { Authorization: `Bearer ${this.token}` }, timeout: TIMEOUT_MS };
  }

  async get<T>(key: string): Promise<{ value: T; at: number } | undefined> {
    try {
      const resp = await http.get(`${this.baseUrl}/get/${encodeURIComponent(key)}`, this.auth);
      const raw = resp.data?.result;
      if (typeof raw !== 'string' || raw.length === 0) return undefined;
      const env = JSON.parse(raw) as Envelope<T>;
      if (!env || typeof env.at !== 'number') return undefined;
      return { value: env.v, at: env.at };
    } catch (e: any) {
      debugLog('upstash.get.fail', { key, error: e?.message });
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      const body = JSON.stringify({ v: value, at: this.now() } satisfies Envelope<T>);
      if (body.length > MAX_BYTES) {
        debugLog('upstash.set.omitido', { key, bytes: body.length });
        return;
      }
      await http.post(
        `${this.baseUrl}/set/${encodeURIComponent(key)}?EX=${Math.max(1, Math.round(ttlSeconds))}`,
        body,
        { ...this.auth, headers: { ...this.auth.headers, 'Content-Type': 'text/plain' } },
      );
    } catch (e: any) {
      debugLog('upstash.set.fail', { key, error: e?.message });
    }
  }
}

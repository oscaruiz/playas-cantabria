import { http } from '../http/axiosClient';
import { debugLog } from '../utils/debug';

/**
 * Almacén L2 sobre la API REST de Upstash Redis (plan gratuito: 10k comandos/día).
 *
 * Se usa REST y no un cliente Redis a propósito: cero dependencias nuevas, cero
 * sockets persistentes que mantener vivos en un proceso que Render duerme cada
 * 15 minutos.
 *
 * REGLA: esta capa NUNCA lanza ni bloquea la respuesta. Si Upstash no está
 * configurado o falla, la app se comporta exactamente como con solo memoria.
 */

export interface L2Store {
  get<T>(key: string): Promise<{ value: T; at: number } | undefined>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

/** Sobre con marca de tiempo: sin ella no se puede saber si el valor sigue fresco. */
interface Envelope<T> {
  v: T;
  at: number;
}

const TIMEOUT_MS = 1500;
/** Redis rechaza valores enormes y el plan gratuito los cobra caros. */
const MAX_BYTES = 400_000;

export class UpstashRedisStore implements L2Store {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Devuelve el store configurado, o undefined si faltan las variables de entorno. */
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

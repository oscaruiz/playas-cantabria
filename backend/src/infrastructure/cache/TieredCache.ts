import { InMemoryCache } from './InMemoryCache';
import { L2Store } from './UpstashRedisStore';
import { debugLog } from '../utils/debug';

/**
 * Caché de dos niveles: memoria (L1) + almacén remoto opcional (L2).
 *
 * El problema que resuelve: en Render free el proceso se duerme a los 15 minutos
 * y cada despliegue lo reinicia, así que la caché en memoria se evapora y el
 * primer usuario paga el fan-out completo a todos los proveedores (~200
 * peticiones) contra un timeout de 15 s. El L2 sobrevive a eso.
 *
 * Solo se persisten las claves CARAS (allowlist): el plan gratuito de Upstash da
 * 10k comandos/día y las claves por coordenadas de OpenWeather/Open-Meteo, que
 * son cientos, lo agotarían sin aportar gran cosa.
 *
 * Es una subclase de InMemoryCache para que ningún proveedor tenga que cambiar:
 * se cablea en un único punto (dependencies.ts).
 */

/** Familias de clave que merecen viajar al L2 (las de fan-out caro). */
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
   * Solo se consulta el L2 cuando L1 NO tiene nada: es decir, en arranque en frío
   * o tras un despliegue. Durante la vida normal del proceso el L2 no se toca, que
   * es lo que mantiene el consumo dentro del plan gratuito.
   *
   * El valor se siembra con su vida RESTANTE, no con el TTL completo: un dato de
   * hace 20 minutos entra como stale (se sirve al instante y se refresca detrás),
   * nunca como recién traído.
   */
  private async sembrarDesdeL2<T>(
    key: string,
    freshTtlSeconds: number,
    staleTtlSeconds: number,
  ): Promise<void> {
    if (this.state(key) !== 'miss') return;

    // El L2 es un acelerador, nunca una dependencia: si falla, se recalcula. El
    // store actual ya se traga sus errores, pero el contrato se garantiza aquí
    // para que no dependa de la implementación que haya detrás.
    let hit: { value: T; at: number } | undefined;
    try {
      hit = await this.l2.get<T>(key);
    } catch (e: any) {
      debugLog('cache.l2.get.fail', { key, error: e?.message });
      return;
    }
    if (!hit) return;

    const edadSeg = (this.reloj() - hit.at) / 1000;
    if (edadSeg >= staleTtlSeconds) return; // demasiado viejo para servirlo

    this.seed(
      key,
      hit.value,
      Math.max(0, freshTtlSeconds - edadSeg),
      staleTtlSeconds - edadSeg,
    );
    debugLog('cache.l2.hit', { key, edadSeg: Math.round(edadSeg) });
  }

  /** Write-through: lo que se calcula se guarda también en L2, sin esperar. */
  private conEscrituraL2<T>(
    key: string,
    ttlSeconds: number,
    compute: () => Promise<T>,
  ): () => Promise<T> {
    return async () => {
      const value = await compute();
      // No se espera a la escritura, pero SÍ se traga su fallo: una promesa
      // rechazada sin manejar tumba el proceso de Node. El almacén actual nunca
      // lanza, pero el L2 es un punto de extensión y este contrato no puede
      // depender de que la siguiente implementación se acuerde.
      void this.l2.set(key, value, ttlSeconds).catch(() => undefined);
      return value;
    };
  }
}

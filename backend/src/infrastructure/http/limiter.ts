/**
 * Concurrency limit and 429 cooldown, per destination host.
 *
 * The app's real ceiling is not the CPU but the free quotas: OpenWeather
 * cuts off at 60 calls/minute. `/api/beaches/featured` already limits its fan-out to 6
 * beaches at a time, but `/details` had no ceiling: ten users on ten different
 * beaches could fire dozens of calls in seconds and eat up the limit,
 * leaving the app without data for everyone.
 *
 * Queueing does no harm: with stale-while-revalidate the user receives the
 * previous value while the refresh waits its turn.
 */

const LIMITES: Record<string, number> = {
  'api.openweathermap.org': 4,
  // AEMET OpenData limits PER KEY, not per IP, and with little tolerance for bursts:
  // on the first production startup, 40 requests (20 beaches x meta+data)
  // ended with 14 successful and 6 rejected with 429, and the cooldown cut off
  // the rest. Serialized they take a few seconds longer, but that fan-out always
  // happens in the background (/featured refresh), so nobody waits for it.
  'opendata.aemet.es': 1,
  'www.aemet.es': 3,
  'api.open-meteo.com': 4,
  'www.cruzroja.es': 3,
};

/** Default cooldown if the 429 carries no Retry-After. */
const ENFRIAMIENTO_POR_DEFECTO_MS = 60_000;
const ENFRIAMIENTO_MAXIMO_MS = 600_000;

export class HostLimiter {
  private activos = new Map<string, number>();
  private colas = new Map<string, Array<() => void>>();
  private enfriadoHasta = new Map<string, number>();

  constructor(
    private readonly limites: Record<string, number> = LIMITES,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private limite(host: string): number {
    return this.limites[host] ?? Number.POSITIVE_INFINITY;
  }

  /** Milliseconds left before this host can be called again (0 = now). */
  enfriamientoRestanteMs(host: string): number {
    const hasta = this.enfriadoHasta.get(host);
    if (hasta == null) return 0;
    const restante = hasta - this.now();
    if (restante <= 0) {
      this.enfriadoHasta.delete(host);
      return 0;
    }
    return restante;
  }

  /** After a 429: nobody calls that host again until the Retry-After passes. */
  registrar429(host: string, retryAfter: string | number | undefined): void {
    const segundos = typeof retryAfter === 'string' ? Number(retryAfter) : retryAfter;
    const ms =
      Number.isFinite(segundos) && (segundos as number) > 0
        ? Math.min((segundos as number) * 1000, ENFRIAMIENTO_MAXIMO_MS)
        : ENFRIAMIENTO_POR_DEFECTO_MS;
    this.enfriadoHasta.set(host, this.now() + ms);
  }

  async adquirir(host: string): Promise<void> {
    const limite = this.limite(host);
    if (!Number.isFinite(limite)) return;

    const enUso = this.activos.get(host) ?? 0;
    if (enUso < limite) {
      this.activos.set(host, enUso + 1);
      return;
    }

    await new Promise<void>((resolve) => {
      const cola = this.colas.get(host) ?? [];
      cola.push(resolve);
      this.colas.set(host, cola);
    });
    this.activos.set(host, (this.activos.get(host) ?? 0) + 1);
  }

  liberar(host: string): void {
    const limite = this.limite(host);
    if (!Number.isFinite(limite)) return;

    this.activos.set(host, Math.max(0, (this.activos.get(host) ?? 1) - 1));
    const cola = this.colas.get(host);
    const siguiente = cola?.shift();
    if (siguiente) siguiente();
  }

  snapshot(): Record<string, { activos: number; encolados: number; enfriamientoMs: number }> {
    const hosts = new Set([
      ...this.activos.keys(),
      ...this.colas.keys(),
      ...this.enfriadoHasta.keys(),
    ]);
    const out: Record<string, { activos: number; encolados: number; enfriamientoMs: number }> = {};
    for (const h of hosts) {
      out[h] = {
        activos: this.activos.get(h) ?? 0,
        encolados: this.colas.get(h)?.length ?? 0,
        enfriamientoMs: this.enfriamientoRestanteMs(h),
      };
    }
    return out;
  }
}

export class HostEnfriadoError extends Error {
  readonly code = 'HOST_COOLDOWN';
  constructor(host: string, restanteMs: number) {
    super(`${host} devolvió 429; en enfriamiento ${Math.ceil(restanteMs / 1000)}s`);
    this.name = 'HostEnfriadoError';
  }
}

export const hostLimiter = new HostLimiter();

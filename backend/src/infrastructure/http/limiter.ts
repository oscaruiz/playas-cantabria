/**
 * Límite de concurrencia y enfriamiento por 429, por host de destino.
 *
 * El techo real de la app no es la CPU sino las cuotas gratuitas: OpenWeather
 * corta a 60 llamadas/minuto. `/api/beaches/featured` ya limita su fan-out a 6
 * playas a la vez, pero `/details` no tenía techo: diez usuarios en diez playas
 * distintas podían disparar decenas de llamadas en segundos y comerse el límite,
 * dejando la app sin datos para todos.
 *
 * Encolar no hace daño: con stale-while-revalidate el usuario recibe el valor
 * anterior mientras el refresco espera turno.
 */

const LIMITES: Record<string, number> = {
  'api.openweathermap.org': 4,
  // AEMET OpenData limita POR CLAVE, no por IP, y con poca tolerancia a ráfagas:
  // en el primer arranque en producción, 40 peticiones (20 playas x meta+datos)
  // se saldaron con 14 correctas y 6 rechazadas con 429, y el enfriamiento cortó
  // el resto. Serializadas tardan unos segundos más, pero ese fan-out siempre
  // ocurre en segundo plano (refresco de /featured), así que no lo espera nadie.
  'opendata.aemet.es': 1,
  'www.aemet.es': 3,
  'api.open-meteo.com': 4,
  'www.cruzroja.es': 3,
};

/** Enfriamiento por defecto si el 429 no trae Retry-After. */
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

  /** Milisegundos que faltan para poder volver a llamar a este host (0 = ya). */
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

  /** Tras un 429: nadie vuelve a llamar a ese host hasta que pase el Retry-After. */
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

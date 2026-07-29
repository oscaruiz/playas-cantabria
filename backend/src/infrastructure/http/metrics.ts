/**
 * Contadores de peticiones SALIENTES a proveedores externos.
 *
 * Sin esto no hay forma de saber a qué distancia estamos de las cuotas gratuitas
 * (OpenWeather 60/min y 1M/mes, Open-Meteo 10k/día...): el consumo depende del
 * tráfico y de los TTL, no de una cifra fija. Se expone en /api/_diag/metrics.
 */

export interface HostCounters {
  total: number;
  ok: number;
  clientError: number;
  rateLimited: number;
  serverError: number;
  networkError: number;
  lastAt: string | null;
}

const EMPTY = (): HostCounters => ({
  total: 0,
  ok: 0,
  clientError: 0,
  rateLimited: 0,
  serverError: 0,
  networkError: 0,
  lastAt: null,
});

/** Ventana horaria: se reinicia sola al cambiar de hora (sin timers). */
interface Window {
  startedAt: number;
  byHost: Map<string, HostCounters>;
}

function newWindow(now: number): Window {
  return { startedAt: now, byHost: new Map() };
}

export class HttpMetrics {
  private total = new Map<string, HostCounters>();
  private hour: Window;
  private day: Window;

  constructor(private readonly now: () => number = () => Date.now()) {
    this.hour = newWindow(this.now());
    this.day = newWindow(this.now());
  }

  record(host: string, status: number | null): void {
    const now = this.now();
    if (now - this.hour.startedAt >= 3_600_000) this.hour = newWindow(now);
    if (now - this.day.startedAt >= 86_400_000) this.day = newWindow(now);

    for (const bucket of [this.total, this.hour.byHost, this.day.byHost]) {
      const c = bucket.get(host) ?? EMPTY();
      c.total++;
      if (status == null) c.networkError++;
      else if (status === 429) c.rateLimited++;
      else if (status >= 500) c.serverError++;
      else if (status >= 400) c.clientError++;
      else c.ok++;
      c.lastAt = new Date(now).toISOString();
      bucket.set(host, c);
    }
  }

  snapshot() {
    const asObject = (m: Map<string, HostCounters>) => Object.fromEntries(m);
    return {
      desdeArranque: asObject(this.total),
      ultimaHora: asObject(this.hour.byHost),
      ultimoDia: asObject(this.day.byHost),
    };
  }

  /** Solo para tests. */
  reset(): void {
    this.total.clear();
    this.hour = newWindow(this.now());
    this.day = newWindow(this.now());
  }
}

export const httpMetrics = new HttpMetrics();

/** Host de una URL, tolerante a URLs relativas o inválidas. */
export function hostOf(url: string | undefined, base?: string): string {
  if (!url) return 'desconocido';
  try {
    return new URL(url, base).host;
  } catch {
    return 'desconocido';
  }
}

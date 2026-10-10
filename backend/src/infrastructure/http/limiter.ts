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
 *
 * The cooldown escalates with consecutive 429s. A flat 60 s let the host's
 * whole concurrency go out again every minute against a quota that was still
 * exhausted: Open-Meteo blocks the shared Render IP for hours, and on
 * 7/9-oct-2026 that was ~4 real 429s a minute, prolonging the block.
 */

import { currentTicket, type Ticket } from './priority';

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

/**
 * Requests per rolling minute, per host. Concurrency alone does not bound the
 * rate: a cold `/featured` fan-out at 4 in flight still sends one observation
 * per beach within the same minute, and the regions together already have more
 * beaches than OpenWeather's 60/min.
 * ponytail: per process. The CI snapshot builder shares the key from another
 * process, hence the margin under 60; a shared counter (Upstash) if that bites.
 */
export const RATE_PER_MINUTE: Record<string, number> = {
  'api.openweathermap.org': 50,
};

const MINUTE_MS = 60_000;

/**
 * Share of a per-minute cap that background work may use. The rest is held for
 * the calls a user is waiting on: a cold /details costs two OpenWeather calls,
 * so the 20 left out of 50 cover ~10 beaches opened in the same minute as a
 * full ranking refresh, which then takes ~2 min instead of ~1 (served stale).
 *
 * Reserved, not a wait budget: a call that gave up on a full window would send
 * the detail out with AEMET's sky while the ranking, which waits, shows
 * OpenWeather's, and a ranking refresh joining that call would inherit the
 * failure. Measured on 10-oct-2026; the detail and the ranking must agree.
 */
const BACKGROUND_RATE_SHARE = 0.6;
// ponytail: the background threshold counts every send, so a sustained 30+
// waited-for calls a minute (15+ beaches opened cold per minute, far above the
// real traffic) holds background work back until it eases; meanwhile the
// ranking is served stale. Per-lane accounting if that traffic ever shows up.

/**
 * How often a call waiting for room in the rate window looks again. A short poll
 * and not one long sleep until the oldest send ages out, because a background
 * call can be promoted while it waits and must not sleep through it.
 * ponytail: polling; a wake-up per promotion if hosts with caps multiply.
 */
const RATE_POLL_MS = 1000;

/** Default cooldown if the 429 carries no Retry-After; doubles per consecutive 429. */
const ENFRIAMIENTO_POR_DEFECTO_MS = 60_000;
const ENFRIAMIENTO_MAXIMO_MS = 600_000;

interface EnCola {
  resolve: () => void;
  ticket?: Ticket;
}

export class HostLimiter {
  private activos = new Map<string, number>();
  private colas = new Map<string, EnCola[]>();
  private enfriadoHasta = new Map<string, number>();
  private sent = new Map<string, number[]>();
  /** Consecutive 429s per host; a success resets it. */
  private rachas429 = new Map<string, number>();

  constructor(
    private readonly limites: Record<string, number> = LIMITES,
    private readonly now: () => number = () => Date.now(),
    private readonly ratePerMinute: Record<string, number> = RATE_PER_MINUTE,
  ) {}

  /** Sends in the last minute, oldest first. */
  private recentSends(host: string): number[] {
    const now = this.now();
    const recent = (this.sent.get(host) ?? []).filter((t) => t > now - MINUTE_MS);
    this.sent.set(host, recent);
    return recent;
  }

  /** Whether one more send fits under the host's per-minute cap for this lane. */
  private rateRoom(host: string, ticket?: Ticket): boolean {
    const cap = this.ratePerMinute[host];
    if (cap == null) return true;
    const laneCap = ticket?.background ? Math.floor(cap * BACKGROUND_RATE_SHARE) : cap;
    return this.recentSends(host).length < laneCap;
  }

  /** Waits, WITHOUT holding a slot, until the rate window has room for this lane. */
  private async waitForRate(host: string, ticket?: Ticket): Promise<void> {
    while (!this.rateRoom(host, ticket)) {
      const untilFree = this.recentSends(host)[0] + MINUTE_MS - this.now();
      await new Promise((r) => setTimeout(r, Math.max(1, Math.min(untilFree, RATE_POLL_MS))));
    }
  }

  private async takeSlot(host: string, ticket?: Ticket): Promise<void> {
    const limite = this.limite(host);
    if (!Number.isFinite(limite)) return;
    const enUso = this.activos.get(host) ?? 0;
    if (enUso < limite) {
      this.activos.set(host, enUso + 1);
      return;
    }
    // The slot is handed over by `liberar` without ever being counted free, so
    // nothing arriving in between can take it.
    await new Promise<void>((resolve) => {
      const cola = this.colas.get(host) ?? [];
      cola.push({ resolve, ticket });
      this.colas.set(host, cola);
    });
  }

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

  /**
   * After a 429: nobody calls that host again until the Retry-After passes.
   * Without one, the default doubles with each consecutive 429 (60 s, 2, 4,
   * 8 min) up to the ceiling; the server's own Retry-After always wins.
   */
  registrar429(host: string, retryAfter: string | number | undefined): void {
    const racha = (this.rachas429.get(host) ?? 0) + 1;
    this.rachas429.set(host, racha);
    const segundos = typeof retryAfter === 'string' ? Number(retryAfter) : retryAfter;
    const ms =
      Number.isFinite(segundos) && (segundos as number) > 0
        ? (segundos as number) * 1000
        : ENFRIAMIENTO_POR_DEFECTO_MS * 2 ** (racha - 1);
    this.enfriadoHasta.set(host, this.now() + Math.min(ms, ENFRIAMIENTO_MAXIMO_MS));
  }

  /** A response that was not a 429: the host is answering again. */
  registrarExito(host: string): void {
    this.rachas429.delete(host);
  }

  /**
   * A turn to send to `host`. Calls a user waits on (no ticket, or a promoted
   * one) go before background ones, both for a slot and for the rate window.
   *
   * The rate is waited for WITHOUT a slot. Sleeping on the window while holding
   * one is what let a ranking refresh park all four OpenWeather slots for a
   * minute, with every /details queued behind them (10-oct-2026). The send is
   * still recorded once the slot is taken, so the timestamp is the send time:
   * counted earlier, requests queued for a slot would leave in a burst.
   */
  async adquirir(host: string, ticket: Ticket | undefined = currentTicket()): Promise<void> {
    for (;;) {
      await this.waitForRate(host, ticket);
      await this.takeSlot(host, ticket);
      if (this.rateRoom(host, ticket)) {
        if (this.ratePerMinute[host] != null) this.recentSends(host).push(this.now());
        return;
      }
      // Someone else used the room while this one waited for a slot.
      this.liberar(host);
    }
  }

  liberar(host: string): void {
    const limite = this.limite(host);
    if (!Number.isFinite(limite)) return;

    const cola = this.colas.get(host);
    if (!cola?.length) {
      this.activos.set(host, Math.max(0, (this.activos.get(host) ?? 1) - 1));
      return;
    }
    // Handed straight to the next in line: `activos` stays as it is. Freeing it
    // first and letting the waiter take it back after an await left a gap where
    // a new request took it too, 2 in flight with a limit of 1 (found by Codex).
    // Read at release time, not at enqueue time: a ticket may have been promoted.
    const i = cola.findIndex((e) => !e.ticket?.background);
    const [siguiente] = cola.splice(i === -1 ? 0 : i, 1);
    siguiente.resolve();
  }

  snapshot(): Record<string, { activos: number; encolados: number; enfriamientoMs: number; racha429: number }> {
    const hosts = new Set([
      ...this.activos.keys(),
      ...this.colas.keys(),
      ...this.enfriadoHasta.keys(),
      ...this.rachas429.keys(),
    ]);
    const out: Record<string, { activos: number; encolados: number; enfriamientoMs: number; racha429: number }> = {};
    for (const h of hosts) {
      out[h] = {
        activos: this.activos.get(h) ?? 0,
        encolados: this.colas.get(h)?.length ?? 0,
        enfriamientoMs: this.enfriamientoRestanteMs(h),
        racha429: this.rachas429.get(h) ?? 0,
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

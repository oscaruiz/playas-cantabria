import { describe, it, expect, vi, afterEach } from 'vitest';
import { http } from '../infrastructure/http/axiosClient';
import { hostLimiter } from '../infrastructure/http/limiter';
import { httpMetrics } from '../infrastructure/http/metrics';

/**
 * Contract of the 429 cooldown, checked through the real HTTP client
 * (interceptors included), not the limiter in isolation.
 *
 * What gets pinned down is the case that failed in production: in a fan-out, the
 * requests all come in at once and wait their turn. If the cooldown were only
 * checked on entry, a 429 arriving mid-burst would not brake the ones already
 * in the queue — and against AEMET that translated into six 429s instead of one.
 */

const HOST_FALSO = 'https://opendata.aemet.es/opendata/api/prueba';

afterEach(() => {
  vi.restoreAllMocks();
  httpMetrics.reset();
});

describe('cliente HTTP — enfriamiento tras un 429', () => {
  it('una ráfaga encolada se corta en cuanto la primera respuesta trae 429', async () => {
    let enviadas = 0;

    // The adapter is the last thing to run: counting here measures what ACTUALLY
    // goes out to the network, after semaphore and cooldown.
    const adapter = vi.fn(async (config: any) => {
      enviadas++;
      await new Promise((r) => setTimeout(r, 5));
      const error: any = new Error('Too Many Requests');
      error.config = config;
      error.response = { status: 429, headers: { 'retry-after': '30' } };
      throw error;
    });

    const resultados = await Promise.allSettled(
      Array.from({ length: 20 }, () => http.get(HOST_FALSO, { adapter } as any)),
    );

    expect(resultados.every((r) => r.status === 'rejected')).toBe(true);
    // With concurrency 1 for AEMET, only the first one should reach the network;
    // the other 19 die in the cooldown without spending quota.
    expect(enviadas).toBe(1);
    expect(hostLimiter.enfriamientoRestanteMs('opendata.aemet.es')).toBeGreaterThan(0);
  });

  it('no deja huecos del semáforo bloqueados al rechazar por enfriamiento', async () => {
    const adapter = vi.fn(async (config: any) => {
      const error: any = new Error('Too Many Requests');
      error.config = config;
      error.response = { status: 429, headers: {} };
      throw error;
    });

    await Promise.allSettled(
      Array.from({ length: 5 }, () => http.get(HOST_FALSO, { adapter } as any)),
    );

    const estado = hostLimiter.snapshot()['opendata.aemet.es'];
    expect(estado.activos).toBe(0);
    expect(estado.encolados).toBe(0);
  });
});

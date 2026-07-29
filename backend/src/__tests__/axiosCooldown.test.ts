import { describe, it, expect, vi, afterEach } from 'vitest';
import { http } from '../infrastructure/http/axiosClient';
import { hostLimiter } from '../infrastructure/http/limiter';
import { httpMetrics } from '../infrastructure/http/metrics';

/**
 * Contrato del enfriamiento por 429, comprobado a través del cliente HTTP real
 * (interceptores incluidos), no del limitador aislado.
 *
 * Lo que se fija es el caso que falló en producción: en un fan-out, las
 * peticiones entran todas a la vez y esperan turno. Si el enfriamiento solo se
 * mirase al entrar, un 429 llegado a mitad de la ráfaga no frenaría a las que ya
 * están en la cola — y contra AEMET eso se tradujo en seis 429 en vez de uno.
 */

const HOST_FALSO = 'https://opendata.aemet.es/opendata/api/prueba';

afterEach(() => {
  vi.restoreAllMocks();
  httpMetrics.reset();
});

describe('cliente HTTP — enfriamiento tras un 429', () => {
  it('una ráfaga encolada se corta en cuanto la primera respuesta trae 429', async () => {
    let enviadas = 0;

    // El adaptador es lo último que se ejecuta: contar aquí mide lo que DE VERDAD
    // sale a la red, después de semáforo y enfriamiento.
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
    // Con concurrencia 1 para AEMET, solo la primera debería llegar a la red;
    // las otras 19 mueren en el enfriamiento sin gastar cuota.
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

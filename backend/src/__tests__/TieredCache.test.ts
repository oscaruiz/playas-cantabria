import { describe, it, expect } from 'vitest';
import { TieredCache, esPersistible } from '../infrastructure/cache/TieredCache';
import { L2Store } from '../infrastructure/cache/UpstashRedisStore';

/** L2 de mentira, con contadores para comprobar el consumo de comandos. */
class L2Falso implements L2Store {
  gets = 0;
  sets = 0;
  private store = new Map<string, { value: unknown; at: number }>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  async get<T>(key: string) {
    this.gets++;
    return this.store.get(key) as { value: T; at: number } | undefined;
  }

  async set<T>(key: string, value: T, _ttl: number) {
    this.sets++;
    this.store.set(key, { value, at: this.now() });
  }

  /** Simula un valor que ya estaba en Redis antes de arrancar el proceso. */
  sembrar(key: string, value: unknown, at: number) {
    this.store.set(key, { value, at });
  }
}

const esperarVaciadoDeCola = () => new Promise((r) => setTimeout(r, 0));

describe('TieredCache', () => {
  it('en arranque en frío sirve el valor del L2 sin llamar al proveedor', async () => {
    let ahora = 1_000_000;
    const l2 = new L2Falso(() => ahora);
    l2.sembrar('featured:beaches', { mejores: ['Berria'] }, ahora - 60_000); // 1 min
    const cache = new TieredCache(l2, () => ahora);

    let llamadas = 0;
    const valor = await cache.getOrSetStale('featured:beaches', 300, 3600, async () => {
      llamadas++;
      return { mejores: ['recalculado'] };
    });

    expect(valor).toEqual({ mejores: ['Berria'] });
    expect(llamadas).toBe(0);
  });

  it('un valor de L2 más viejo que la ventana fresca entra como stale y se refresca detrás', async () => {
    let ahora = 1_000_000;
    const l2 = new L2Falso(() => ahora);
    l2.sembrar('featured:beaches', { v: 'viejo' }, ahora - 600_000); // 10 min > fresh 5 min
    const cache = new TieredCache(l2, () => ahora);

    let llamadas = 0;
    const valor = await cache.getOrSetStale('featured:beaches', 300, 3600, async () => {
      llamadas++;
      return { v: 'nuevo' };
    });

    // Se sirve el viejo al instante...
    expect(valor).toEqual({ v: 'viejo' });
    // ...y se dispara el recálculo en segundo plano.
    await esperarVaciadoDeCola();
    expect(llamadas).toBe(1);
  });

  it('descarta un valor de L2 más viejo que la ventana stale', async () => {
    let ahora = 1_000_000;
    const l2 = new L2Falso(() => ahora);
    l2.sembrar('featured:beaches', { v: 'caducado' }, ahora - 7_200_000); // 2 h > stale 1 h
    const cache = new TieredCache(l2, () => ahora);

    const valor = await cache.getOrSetStale('featured:beaches', 300, 3600, async () => ({
      v: 'nuevo',
    }));

    expect(valor).toEqual({ v: 'nuevo' });
  });

  it('no toca el L2 mientras L1 tenga el dato (presupuesto de comandos)', async () => {
    const l2 = new L2Falso();
    const cache = new TieredCache(l2);

    for (let i = 0; i < 10; i++) {
      await cache.getOrSetStale('featured:beaches', 300, 3600, async () => ({ v: i }));
    }

    expect(l2.gets).toBe(1); // solo el fallo inicial
    expect(l2.sets).toBe(1);
  });

  it('no persiste las claves por coordenadas, que agotarían la cuota de Upstash', async () => {
    const l2 = new L2Falso();
    const cache = new TieredCache(l2);

    await cache.getOrSetStale('weather:OpenWeather:43.4,-4.2', 300, 3600, async () => ({ t: 20 }));
    await cache.getOrSet('openmeteo:now:43.4,-4.2', 300, async () => ({ mm: 0 }));

    expect(l2.gets).toBe(0);
    expect(l2.sets).toBe(0);
  });

  it('un L2 caído no rompe nada: se recalcula y se sirve igual', async () => {
    const l2Roto: L2Store = {
      get: async () => {
        throw new Error('Upstash caído');
      },
      set: async () => {
        throw new Error('Upstash caído');
      },
    };
    // El store real nunca lanza, pero si alguien mete uno que sí lo haga,
    // la caché no debe arrastrar la petición del usuario.
    const cache = new TieredCache({
      get: async () => undefined,
      set: l2Roto.set,
    });

    await expect(
      cache.getOrSetStale('details:3902401', 60, 600, async () => ({ ok: true })),
    ).resolves.toEqual({ ok: true });
  });

  it('la allowlist cubre las familias caras y solo esas', () => {
    expect(esPersistible('featured:beaches')).toBe(true);
    expect(esPersistible('details:3902401')).toBe(true);
    expect(esPersistible('flag:cr:555')).toBe(true);
    expect(esPersistible('aemet:obs:todas')).toBe(true);
    expect(esPersistible('ow:forecast:43.4,-4.2')).toBe(false);
    expect(esPersistible('aemet:web:3902401')).toBe(false);
  });
});

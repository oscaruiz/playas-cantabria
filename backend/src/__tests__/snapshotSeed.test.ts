import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { sembrarDesdeSnapshot } from '../infrastructure/cache/snapshotSeed';
import { InMemoryCache, CacheKeys } from '../infrastructure/cache/InMemoryCache';

const temporales: string[] = [];

function escribirSnapshot(contenido: unknown): string {
  const ruta = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-')),
    'snapshot.json',
  );
  fs.writeFileSync(ruta, JSON.stringify(contenido), 'utf-8');
  temporales.push(ruta);
  return ruta;
}

const region = (snapshotPath: string) => ({ id: 'cantabria', snapshotPath });

afterEach(() => {
  while (temporales.length) {
    try {
      fs.rmSync(path.dirname(temporales.pop() as string), { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }
});

describe('sembrarDesdeSnapshot', () => {
  it('siembra el instante del fichero, no el del arranque', async () => {
    // Sin esto la primera respuesta tras un despliegue salía diciendo que el
    // ranking acababa de calcularse, cuando venía de un fichero de hace horas.
    const generatedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const ruta = escribirSnapshot({ generatedAt, featured: { mejores: [] } });
    const cache = new InMemoryCache();

    expect(sembrarDesdeSnapshot(cache, region(ruta))).toBe(true);

    // Se lee como lo lee el endpoint: `get` devuelve undefined para una
    // entrada stale, y sembrada como stale es justo lo que está.
    const sembrado = await cache.getOrSetStale<{ generadoEn?: number }>(
      CacheKeys.featuredBeaches('cantabria'),
      300,
      3600,
      async () => ({ generadoEn: Date.now() }),
    );
    expect(sembrado.generadoEn).toBe(Date.parse(generatedAt));
  });

  it('siembra el agregado como STALE: se sirve al instante y se refresca detrás', () => {
    const ruta = escribirSnapshot({
      generatedAt: new Date().toISOString(),
      featured: { mejores: ['Berria'] },
    });
    const cache = new InMemoryCache();

    expect(sembrarDesdeSnapshot(cache, region(ruta))).toBe(true);
    // 'stale', not 'fresh': the data is from a while ago and does not masquerade as new.
    expect(cache.state(CacheKeys.featuredBeaches('cantabria'))).toBe('stale');
  });

  it('descarta un snapshot de más de 6 h: las banderas del día ya no valen', () => {
    const ruta = escribirSnapshot({
      generatedAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
      featured: { mejores: ['Berria'] },
    });
    const cache = new InMemoryCache();

    expect(sembrarDesdeSnapshot(cache, region(ruta))).toBe(false);
    expect(cache.state(CacheKeys.featuredBeaches('cantabria'))).toBe('miss');
  });

  it('no rompe el arranque si el fichero no existe', () => {
    const cache = new InMemoryCache();
    expect(sembrarDesdeSnapshot(cache, region('data/no-existe.json'))).toBe(false);
  });

  it('no rompe el arranque si el fichero está corrupto o incompleto', () => {
    const cache = new InMemoryCache();
    const corrupto = escribirSnapshot({ generatedAt: new Date().toISOString() }); // no featured
    expect(sembrarDesdeSnapshot(cache, region(corrupto))).toBe(false);
  });

  it('ignora un generatedAt del futuro (reloj descuadrado en CI)', () => {
    const ruta = escribirSnapshot({
      generatedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      featured: { mejores: ['Berria'] },
    });
    const cache = new InMemoryCache();

    expect(sembrarDesdeSnapshot(cache, region(ruta))).toBe(false);
  });
});

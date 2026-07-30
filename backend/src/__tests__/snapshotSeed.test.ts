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
  it('siembra el agregado como STALE: se sirve al instante y se refresca detrás', () => {
    const ruta = escribirSnapshot({
      generatedAt: new Date().toISOString(),
      featured: { mejores: ['Berria'] },
    });
    const cache = new InMemoryCache();

    expect(sembrarDesdeSnapshot(cache, ruta)).toBe(true);
    // 'stale', not 'fresh': the data is from a while ago and does not masquerade as new.
    expect(cache.state(CacheKeys.featuredBeaches)).toBe('stale');
  });

  it('descarta un snapshot de más de 6 h: las banderas del día ya no valen', () => {
    const ruta = escribirSnapshot({
      generatedAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
      featured: { mejores: ['Berria'] },
    });
    const cache = new InMemoryCache();

    expect(sembrarDesdeSnapshot(cache, ruta)).toBe(false);
    expect(cache.state(CacheKeys.featuredBeaches)).toBe('miss');
  });

  it('no rompe el arranque si el fichero no existe', () => {
    const cache = new InMemoryCache();
    expect(sembrarDesdeSnapshot(cache, 'data/no-existe.json')).toBe(false);
  });

  it('no rompe el arranque si el fichero está corrupto o incompleto', () => {
    const cache = new InMemoryCache();
    const corrupto = escribirSnapshot({ generatedAt: new Date().toISOString() }); // no featured
    expect(sembrarDesdeSnapshot(cache, corrupto)).toBe(false);
  });

  it('ignora un generatedAt del futuro (reloj descuadrado en CI)', () => {
    const ruta = escribirSnapshot({
      generatedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      featured: { mejores: ['Berria'] },
    });
    const cache = new InMemoryCache();

    expect(sembrarDesdeSnapshot(cache, ruta)).toBe(false);
  });
});

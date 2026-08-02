/**
 * Runs the REAL prerender script against a temporary build directory with
 * the real synced catalog. This is the closest thing to the deployed
 * acceptance check ("curl returns meaningful beach text") that CI can do.
 */

// Classic specifiers, not `node:` — @types/node here is v12 and predates them.
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const PLANTILLA = `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Playas Cantabria</title></head><body><div id="root"></div></body></html>`;

function ejecutarPrerender(dir: string): string {
  return execFileSync('node', ['scripts/prerender.mjs', dir], {
    cwd: join(__dirname, '..', '..'),
    encoding: 'utf8',
  });
}

describe('scripts/prerender.mjs', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'prerender-'));
    writeFileSync(join(dir, 'index.html'), PLANTILLA);
  });

  afterEach(() => {
    rmdirSync(dir, { recursive: true });
  });

  it('genera una página por playa con título, canónica y contenido estático', () => {
    const salida = ejecutarPrerender(dir);
    expect(salida).toMatch(/rutas generadas/);

    const ficha = readFileSync(join(dir, 'playas', 'suances', 'la-concha', 'index.html'), 'utf8');
    expect(ficha).toContain('<title>La Concha: bandera, tiempo y mareas hoy | Playas Cantabria</title>');
    expect(ficha).toContain('<h1>Playa de La Concha</h1>');
    expect(ficha).toContain('Suances');
    // Honesty: the static page must not claim live data; it says it loads.
    expect(ficha).toContain('se cargan al abrir la aplicación');
    expect(ficha).toContain('rel="canonical"');
    expect(ficha).toContain('/playas/suances/la-concha');
    // Crawlable navigation out of the page.
    expect(ficha).toContain('href="/playas"');
  });

  it('el índice y el listado llevan enlaces a todas las playas', () => {
    ejecutarPrerender(dir);

    const catalogo = JSON.parse(
      readFileSync(join(__dirname, '..', 'data', 'beaches.json'), 'utf8')
    ) as Array<unknown>;

    const listado = readFileSync(join(dir, 'playas', 'index.html'), 'utf8');
    const enlaces = listado.match(/href="\/playas\/[^"]+\/[^"]+"/g) ?? [];
    expect(enlaces.length).toBe(catalogo.length);

    // The root index.html is ALSO rewritten (route "/").
    const inicio = readFileSync(join(dir, 'index.html'), 'utf8');
    expect(inicio).toContain('<h1>Playas de Cantabria</h1>');
    expect(inicio).not.toContain('<div id="root"></div>');
  });

  it('falla en alto si la plantilla no tiene el root vacío', () => {
    writeFileSync(join(dir, 'index.html'), PLANTILLA.replace('<div id="root"></div>', '<div id="app"></div>'));
    expect(() => ejecutarPrerender(dir)).toThrow();
  });
});

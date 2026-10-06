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

const TEMPLATE = `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Playas Cantabria</title></head><body><div id="root"></div></body></html>`;

function runPrerender(dir: string): string {
  return execFileSync('node', ['scripts/prerender.mjs', dir], {
    cwd: join(__dirname, '..', '..', '..'),
    encoding: 'utf8',
  });
}

describe('scripts/prerender.mjs', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'prerender-'));
    writeFileSync(join(dir, 'index.html'), TEMPLATE);
  });

  afterEach(() => {
    rmdirSync(dir, { recursive: true });
  });

  it('genera una página por playa con título, canónica y contenido estático', () => {
    const output = runPrerender(dir);
    expect(output).toMatch(/rutas generadas/);

    const sheet = readFileSync(join(dir, 'playas', 'suances', 'la-concha', 'index.html'), 'utf8');
    expect(sheet).toContain('<title>La Concha: bandera, tiempo y mareas hoy | Playucas.es</title>');
    expect(sheet).toContain('<h1>Playa de La Concha</h1>');
    expect(sheet).toContain('Suances');
    // Honesty: the static page must not claim live data; it says it loads.
    expect(sheet).toContain('se cargan al abrir la aplicación');
    expect(sheet).toContain('rel="canonical"');
    expect(sheet).toContain('/playas/suances/la-concha');
    // Crawlable navigation out of the page.
    expect(sheet).toContain('href="/playas"');
  });

  it('el índice y el listado llevan enlaces a todas las playas', () => {
    runPrerender(dir);

    const catalog = JSON.parse(
      readFileSync(join(__dirname, '..', '..', 'data', 'beaches.json'), 'utf8')
    ) as Array<unknown>;

    const listing = readFileSync(join(dir, 'playas', 'index.html'), 'utf8');
    const links = listing.match(/href="\/playas\/[^"]+\/[^"]+"/g) ?? [];
    expect(links.length).toBe(catalog.length);

    // The root index.html is ALSO rewritten (route "/").
    const start = readFileSync(join(dir, 'index.html'), 'utf8');
    expect(start).toContain('<h1>Playucas.es</h1>');
    expect(start).not.toContain('<div id="root"></div>');
  });

  it('oculta el bloque estático en cuanto hay JS, pero lo deja en el HTML', () => {
    runPrerender(dir);
    const start = readFileSync(join(dir, 'index.html'), 'utf8');

    // The rule is in the head, so the block never gets painted while the
    // bundle loads: that flash of unstyled links read as a broken page.
    expect(start).toContain('html.con-js .prerender{display:none}');
    expect(start.indexOf('con-js')).toBeLessThan(start.indexOf('class="prerender"'));
    // Hidden for the user, still there for whoever parses the HTML.
    expect(start).toContain('<h1>Playucas.es</h1>');
  });

  it('genera páginas de municipio y de landings (Fase 6) desde los mismos selectores', () => {
    runPrerender(dir);

    // The index is the crawlable entry to every municipality page, and the
    // shared static nav links it from every generated page.
    const index = readFileSync(join(dir, 'municipios', 'index.html'), 'utf8');
    expect(index).toContain('Municipios con playa en Cantabria');
    expect(index).toContain('href="/municipios/suances"');

    const municipality = readFileSync(join(dir, 'municipios', 'suances', 'index.html'), 'utf8');
    expect(municipality).toContain('<h1>Playas de Suances</h1>');
    expect(municipality).toContain('href="/playas/suances/la-concha"');
    expect(municipality).toContain('href="/municipios"');

    const webcam = readFileSync(join(dir, 'playas-con-webcam', 'index.html'), 'utf8');
    expect(webcam).toContain('Playas con webcam en Cantabria');
    expect(webcam).toContain('la app no comprueba si emite');
  });

  it('falla en alto si la plantilla no tiene el root vacío', () => {
    writeFileSync(join(dir, 'index.html'), TEMPLATE.replace('<div id="root"></div>', '<div id="app"></div>'));
    expect(() => runPrerender(dir)).toThrow();
  });
});

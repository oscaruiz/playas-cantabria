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

  it('generates one page per beach with title, canonical and static content', () => {
    const output = runPrerender(dir);
    expect(output).toMatch(/rutas generadas/);

    const sheet = readFileSync(join(dir, 'playas', 'suances', 'la-concha', 'index.html'), 'utf8');
    expect(sheet).toContain('<title>Playa de La Concha (Suances): bandera, tiempo y mareas hoy | Playucas.es</title>');
    expect(sheet).toContain('<h1>Playa de La Concha</h1>');
    expect(sheet).toContain('Suances');
    // Honesty: the static page must not claim live data; it says it loads.
    expect(sheet).toContain('se cargan al abrir la aplicación');
    expect(sheet).toContain('rel="canonical"');
    expect(sheet).toContain('/playas/suances/la-concha');
    // Crawlable navigation out of the page.
    expect(sheet).toContain('href="/playas"');
    // Richer crawlable content: prose, how to get there, nearby beaches.
    expect(sheet).toContain('La playa de La Concha está en Suances (Cantabria) y mide unos 1000 m de largo y 60 m de ancho.');
    expect(sheet).toContain('Cómo llegar y aparcar en La Concha');
    expect(sheet).toContain('No figura como playa apta para perros.');
    expect(sheet).toContain('Playas cerca de La Concha');
  });

  it('beach pages carry Beach + BreadcrumbList JSON-LD with only catalog facts', () => {
    runPrerender(dir);
    const sheet = readFileSync(join(dir, 'playas', 'suances', 'la-concha', 'index.html'), 'utf8');
    const match = sheet.match(/<script type="application\/ld\+json">([^<]*)<\/script>/);
    expect(match).not.toBeNull();
    const graph = JSON.parse((match as RegExpMatchArray)[1])['@graph'];
    const beach = graph.find((n: { '@type': string }) => n['@type'] === 'Beach');
    expect(beach.name).toBe('Playa de La Concha');
    expect(beach.address.addressLocality).toBe('Suances');
    expect(beach.url).toMatch(/\/playas\/suances\/la-concha$/);
    const crumbs = graph.find((n: { '@type': string }) => n['@type'] === 'BreadcrumbList');
    expect(crumbs.itemListElement).toHaveLength(3);
  });

  it('the index and the listing carry links to every beach', () => {
    runPrerender(dir);

    const catalog = JSON.parse(
      readFileSync(join(__dirname, '..', '..', 'data', 'beaches.json'), 'utf8')
    ) as Array<unknown>;

    const listing = readFileSync(join(dir, 'playas', 'index.html'), 'utf8');
    const links = listing.match(/href="\/playas\/[^"]+\/[^"]+"/g) ?? [];
    expect(links.length).toBe(catalog.length);

    // The root index.html is ALSO rewritten (route "/").
    const start = readFileSync(join(dir, 'index.html'), 'utf8');
    expect(start).toContain('<h1>Playas de Cantabria</h1>');
    expect(start).not.toContain('<div id="root"></div>');
  });

  it('hides the static block as soon as JS is on, but leaves it in the HTML', () => {
    runPrerender(dir);
    const start = readFileSync(join(dir, 'index.html'), 'utf8');

    // The rule is in the head, so the block never gets painted while the
    // bundle loads: that flash of unstyled links read as a broken page.
    expect(start).toContain('html.with-js .prerender{display:none}');
    expect(start.indexOf('with-js')).toBeLessThan(start.indexOf('class="prerender"'));
    // Hidden for the user, still there for whoever parses the HTML.
    expect(start).toContain('<h1>Playas de Cantabria</h1>');
  });

  it('generates municipality and landing pages (Phase 6) from the same selectors', () => {
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

  it('fails loudly if the template does not have an empty root', () => {
    writeFileSync(join(dir, 'index.html'), TEMPLATE.replace('<div id="root"></div>', '<div id="app"></div>'));
    expect(() => runPrerender(dir)).toThrow();
  });
});

/**
 * Generates build/sitemap.xml and build/robots.txt for the region that was
 * just built. Runs as the last step of `npm run build`.
 *
 * URLs come from src/seo/beachUrls.js — the SAME module the app navigates
 * with — so the sitemap can never drift from the routes the app serves.
 * A slug collision or an empty slug is a catalog error and FAILS the build
 * here, loudly, before anything ships.
 *
 * The public origin is resolved from REACT_APP_SITE_ORIGIN, else from the
 * region's Firebase Hosting site in .firebaserc (https://<site>.web.app).
 * A region with no known origin (e.g. a contributed region whose hosting
 * site does not exist yet) skips sitemap/robots with a warning instead of
 * failing: nothing is publicly served for it, so there is nothing to map —
 * the same deliberate split check-regions makes for hosting targets.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { origenPublico } from './lib/site-origin.mjs';

const require = createRequire(import.meta.url);
const raiz = dirname(fileURLToPath(import.meta.url));
const frontend = join(raiz, '..');

const { rutaPlaya, detectarColisiones } = require('../src/seo/beachUrls.js');
const { landingsNoVacias, municipiosDe, rutaMunicipio } = require('../src/seo/landings.js');

const rutaBuild = join(frontend, 'build');
if (!existsSync(join(rutaBuild, 'index.html'))) {
  console.error('[sitemap] build/index.html no existe. Ejecuta npm run build.');
  process.exit(1);
}

const playas = JSON.parse(readFileSync(join(frontend, 'src', 'data', 'beaches.json'), 'utf8'));
const region = JSON.parse(readFileSync(join(frontend, 'src', 'data', 'region.json'), 'utf8'));

const colisiones = detectarColisiones(playas);
if (colisiones.length > 0) {
  console.error('[sitemap] El catálogo produce rutas canónicas en conflicto:');
  for (const c of colisiones) {
    console.error(`  ${c.ruta} ← códigos ${c.codigos.join(', ')}`);
  }
  console.error('[sitemap] Renombra o desambigua esas playas en el catálogo de la región.');
  process.exit(1);
}

const origen = origenPublico(frontend, region.id);

if (!origen) {
  console.warn(
    `[sitemap] La región "${region.id}" no tiene origen público conocido ` +
      '(ni REACT_APP_SITE_ORIGIN ni sitio de hosting en .firebaserc): ' +
      'no se generan sitemap.xml ni robots.txt.'
  );
  process.exit(0);
}

const rutas = [
  '/',
  '/playas',
  '/mapa',
  '/municipios',
  ...playas.map((p) => rutaPlaya(p)),
  ...municipiosDe(playas).map((m) => rutaMunicipio(m)),
  ...landingsNoVacias(playas).map((l) => `/${l.id}`),
];
const hoy = new Date().toISOString().slice(0, 10);

const sitemap =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  rutas
    .map((r) => `  <url><loc>${origen}${r}</loc><lastmod>${hoy}</lastmod></url>`)
    .join('\n') +
  '\n</urlset>\n';

const robots = `User-agent: *\nAllow: /\n\nSitemap: ${origen}/sitemap.xml\n`;

writeFileSync(join(rutaBuild, 'sitemap.xml'), sitemap);
writeFileSync(join(rutaBuild, 'robots.txt'), robots);
console.log(`[sitemap] ${rutas.length} URLs para ${origen} (sitemap.xml + robots.txt)`);

/**
 * Deterministic build-time prerender (Phase 5). For each public route it
 * writes a route-specific index.html into build/, produced from the built
 * template so the hashed asset references stay intact:
 *
 *   - route-specific <title>, description, canonical and og:* — from the
 *     SAME templates the app uses (src/seo/metadata.js) and the SAME URL
 *     module (src/seo/beachUrls.js);
 *   - server-visible STATIC content inside #root: name, municipality,
 *     catalog facts and crawlable links. React replaces it on mount
 *     (createRoot.render), so there is no hydration to mismatch.
 *
 * NO live data is baked in — a cached HTML claiming today's flag would be
 * exactly the "static dressed as live" failure this project forbids. The
 * content says explicitly that flag/weather/tides load in the app.
 *
 * Any route that cannot be generated fails the build (exit 1), loudly.
 *
 * Firebase serves existing files before applying the SPA rewrite, so
 * unknown routes still fall through to the app shell.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { origenPublico } from './lib/site-origin.mjs';

const require = createRequire(import.meta.url);
const frontend = join(dirname(fileURLToPath(import.meta.url)), '..');

const { rutaPlaya, detectarColisiones } = require('../src/seo/beachUrls.js');
const { PLANTILLAS_SEO, ETIQUETAS_ATTR, rellenar } = require('../src/seo/metadata.js');
const {
  landingsNoVacias,
  municipiosDe,
  rutaMunicipio,
  playasDeMunicipioSlug,
} = require('../src/seo/landings.js');

const rutaBuild = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : join(frontend, 'build');
const plantillaHtml = join(rutaBuild, 'index.html');
if (!existsSync(plantillaHtml)) {
  console.error(`[prerender] ${plantillaHtml} no existe. Ejecuta react-scripts build antes.`);
  process.exit(1);
}

const playas = JSON.parse(readFileSync(join(frontend, 'src', 'data', 'beaches.json'), 'utf8'));
const region = JSON.parse(readFileSync(join(frontend, 'src', 'data', 'region.json'), 'utf8'));

const colisiones = detectarColisiones(playas);
if (colisiones.length > 0) {
  console.error('[prerender] Rutas canónicas en conflicto en el catálogo:');
  for (const c of colisiones) console.error(`  ${c.ruta} ← ${c.codigos.join(', ')}`);
  process.exit(1);
}

const origen = origenPublico(frontend, region.id);
const plantilla = readFileSync(plantillaHtml, 'utf8');

function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Head tags for a route. Canonical/og:url only when the origin is known. */
function etiquetasHead(titulo, descripcion, ruta) {
  const t = escaparHtml(titulo);
  const d = escaparHtml(descripcion);
  const lineas = [
    `<meta name="description" content="${d}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    '<meta property="og:type" content="website" />',
    '<meta name="twitter:card" content="summary" />',
  ];
  if (origen) {
    const url = escaparHtml(`${origen}${ruta}`);
    lineas.push(`<link rel="canonical" href="${url}" />`);
    lineas.push(`<meta property="og:url" content="${url}" />`);
  }
  return lineas.join('\n    ');
}

/** Static facts of a beach as list items. Only what the catalog states. */
function hechosPlaya(p) {
  const filas = [];
  if (p.tipoPlaya) filas.push(['Tipo', p.tipoPlaya]);
  if (p.arena) filas.push(['Arena', p.arena]);
  if (p.longitud) {
    filas.push(['Dimensiones', `${p.longitud} m${p.anchura ? ` × ${p.anchura} m` : ''}`]);
  }
  if (Array.isArray(p.acceso) && p.acceso.length > 0) filas.push(['Acceso', p.acceso.join(' · ')]);
  if (p.parkingDescripcion) filas.push(['Parking', p.parkingDescripcion]);
  if (p.bus) filas.push(['Bus', p.bus]);
  if (p.hospitalDistancia != null) filas.push(['Hospital', `a ${p.hospitalDistancia} km`]);
  return filas
    .map(([k, v]) => `<li><strong>${escaparHtml(k)}:</strong> ${escaparHtml(v)}</li>`)
    .join('\n        ');
}

function serviciosPlaya(p) {
  const activos = Object.entries(p.atributos ?? {})
    .filter(([clave, valor]) => valor === true && ETIQUETAS_ATTR[clave])
    .map(([clave]) => ETIQUETAS_ATTR[clave]);
  if (p.submarinismo) activos.push(ETIQUETAS_ATTR.submarinismo);
  return activos.length > 0
    ? `<p><strong>Servicios:</strong> ${escaparHtml(activos.join(' · '))}</p>`
    : '';
}

const AVISO_ESTATICO =
  '<p><em>Información fija de la playa. La bandera, el tiempo y las mareas de hoy se cargan al abrir la aplicación.</em></p>';

const NAV = `<nav><a href="/">Inicio</a> · <a href="/playas">Todas las playas</a> · <a href="/mapa">Mapa</a></nav>`;

function enlacesPlayas(lista) {
  return lista
    .map((p) => `<li><a href="${rutaPlaya(p)}">${escaparHtml(p.nombre)} (${escaparHtml(p.municipio)})</a></li>`)
    .join('\n        ');
}

/** The visible-before-React block. Plain semantic HTML, lightly styled. */
function bloqueContenido(interior) {
  return (
    `<div class="prerender" style="font-family:Poppins,system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px 16px;line-height:1.5">` +
    `${NAV}\n      ${interior}\n    </div>`
  );
}

function contenidoPlaya(p) {
  return bloqueContenido(
    `<h1>Playa de ${escaparHtml(p.nombre)}</h1>
      <p>${escaparHtml(p.municipio)} · ${escaparHtml(region.name)}</p>
      <ul>
        ${hechosPlaya(p)}
      </ul>
      ${serviciosPlaya(p)}
      ${AVISO_ESTATICO}`
  );
}

function contenidoListado() {
  return bloqueContenido(
    `<h1>Todas las playas de ${escaparHtml(region.name)}</h1>
      <ul>
        ${enlacesPlayas([...playas].sort((a, b) => a.nombre.localeCompare(b.nombre)))}
      </ul>`
  );
}

function contenidoInicio() {
  return bloqueContenido(
    `<h1>Playas de ${escaparHtml(region.name)}</h1>
      <p>Compara las playas de ${escaparHtml(region.name)} y elige la mejor para hoy: puntuación, bandera, tiempo y mareas al abrir la aplicación.</p>
      <ul>
        ${enlacesPlayas([...playas].sort((a, b) => a.nombre.localeCompare(b.nombre)))}
      </ul>`
  );
}

function contenidoMapa() {
  return bloqueContenido(
    `<h1>Mapa de playas de ${escaparHtml(region.name)}</h1>
      <p>El mapa interactivo se carga al abrir la aplicación.</p>`
  );
}

/** Injects head tags + title + root content into the built template. */
function paginaHtml(titulo, descripcion, ruta, contenido) {
  let html = plantilla;
  const conTitulo = html.replace(/<title>[^<]*<\/title>/, `<title>${escaparHtml(titulo)}</title>`);
  if (conTitulo === html) {
    throw new Error('la plantilla no tiene <title>');
  }
  html = conTitulo.replace('</head>', `    ${etiquetasHead(titulo, descripcion, ruta)}\n  </head>`);
  const conRoot = html.replace('<div id="root"></div>', `<div id="root">${contenido}</div>`);
  if (conRoot === html) {
    throw new Error('la plantilla no tiene <div id="root"></div> vacío');
  }
  return conRoot;
}

function escribirRuta(ruta, titulo, descripcion, contenido) {
  const html = paginaHtml(titulo, descripcion, ruta, contenido);
  const destino = ruta === '/' ? plantillaHtml : join(rutaBuild, ...ruta.split('/').filter(Boolean), 'index.html');
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, html);
  return destino;
}

const vars = { region: region.name };
let generadas = 0;

try {
  escribirRuta(
    '/',
    rellenar(PLANTILLAS_SEO.tituloInicio, vars),
    rellenar(PLANTILLAS_SEO.descInicio, vars),
    contenidoInicio()
  );
  generadas += 1;

  escribirRuta(
    '/playas',
    rellenar(PLANTILLAS_SEO.tituloLista, vars),
    rellenar(PLANTILLAS_SEO.descLista, vars),
    contenidoListado()
  );
  generadas += 1;

  escribirRuta(
    '/mapa',
    rellenar(PLANTILLAS_SEO.tituloMapa, vars),
    rellenar(PLANTILLAS_SEO.descMapa, vars),
    contenidoMapa()
  );
  generadas += 1;

  for (const p of playas) {
    escribirRuta(
      rutaPlaya(p),
      rellenar(PLANTILLAS_SEO.tituloDetalle, { ...vars, nombre: p.nombre }),
      rellenar(PLANTILLAS_SEO.descDetalle, { ...vars, nombre: p.nombre, municipio: p.municipio }),
      contenidoPlaya(p)
    );
    generadas += 1;
  }

  // Phase 6: municipality pages — one per municipality in the catalog.
  for (const municipio of municipiosDe(playas)) {
    const ruta = rutaMunicipio(municipio);
    const propias = playasDeMunicipioSlug(playas, ruta.split('/')[2]);
    escribirRuta(
      ruta,
      rellenar(PLANTILLAS_SEO.tituloMunicipio, { ...vars, municipio }),
      rellenar(PLANTILLAS_SEO.descMunicipio, { ...vars, municipio }),
      bloqueContenido(
        `<h1>Playas de ${escaparHtml(municipio)}</h1>
      <p>${escaparHtml(municipio)} · ${escaparHtml(region.name)}</p>
      <ul>
        ${enlacesPlayas(propias)}
      </ul>
      ${AVISO_ESTATICO}`
      )
    );
    generadas += 1;
  }

  // Phase 6: curated landings — empty categories are never published.
  for (const landing of landingsNoVacias(playas)) {
    const titulo = rellenar(landing.textos.titulo, vars);
    const intro = rellenar(landing.textos.intro, vars);
    const propias = playas.filter(landing.filtro);
    escribirRuta(
      `/${landing.id}`,
      `${titulo} | Playas ${region.name}`,
      intro,
      bloqueContenido(
        `<h1>${escaparHtml(titulo)}</h1>
      <p>${escaparHtml(intro)}</p>
      <ul>
        ${enlacesPlayas(propias)}
      </ul>`
      )
    );
    generadas += 1;
  }
} catch (e) {
  console.error(`[prerender] FALLO generando rutas: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}

// The count must be exact: a silently skipped beach is a missing page.
const esperadas = 3 + playas.length + municipiosDe(playas).length + landingsNoVacias(playas).length;
if (generadas !== esperadas) {
  console.error(`[prerender] generadas ${generadas} rutas, esperadas ${esperadas}.`);
  process.exit(1);
}

console.log(
  `[prerender] ${generadas} rutas generadas en build/ (${origen ?? 'sin origen público: sin canónicas absolutas'})`
);

/**
 * Deterministic build-time prerender (Phase 5). For each public route it
 * writes a route-specific index.html into build/, produced from the built
 * template so the hashed asset references stay intact:
 *
 *   - route-specific <title>, description, canonical and og:* — from the
 *     SAME templates the app uses (src/shared/seo/metadata.js) and the SAME URL
 *     module (src/shared/seo/beachUrls.js);
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

const { beachPath, detectCollisions } = require('../src/shared/seo/beachUrls.js');
const { SEO_TEMPLATES, ATTR_LABELS, fillTemplate } = require('../src/shared/seo/metadata.js');
const {
  nonEmptyLandings,
  municipalitiesOf,
  municipalityPath,
  municipalitiesSummary,
  beachesOfMunicipalitySlug,
} = require('../src/shared/seo/landings.js');

const rutaBuild = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : join(frontend, 'build');
const plantillaHtml = join(rutaBuild, 'index.html');
if (!existsSync(plantillaHtml)) {
  console.error(`[prerender] ${plantillaHtml} no existe. Ejecuta react-scripts build antes.`);
  process.exit(1);
}

const playas = JSON.parse(readFileSync(join(frontend, 'src', 'data', 'beaches.json'), 'utf8'));
const region = JSON.parse(readFileSync(join(frontend, 'src', 'data', 'region.json'), 'utf8'));

const colisiones = detectCollisions(playas);
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

/**
 * Head tags for a route. Canonical/og:url and JSON-LD only when the origin is
 * known: structured data needs absolute URLs. `datos` is a function of the
 * absolute-URL builder so callers never concatenate the origin themselves.
 */
function etiquetasHead(titulo, descripcion, ruta, datos) {
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
    if (datos) {
      // `<` escaped so a catalog string can never close the script tag.
      const json = JSON.stringify(datos((r) => `${origen}${r}`)).replace(/</g, '\\u003c');
      lineas.push(`<script type="application/ld+json">${json}</script>`);
    }
  }
  return lineas.join('\n    ');
}

function migas(abs, pasos) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: pasos.map(([nombre, ruta], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: nombre,
      item: abs(ruta),
    })),
  };
}

function listaPlayas(abs, lista) {
  return {
    '@type': 'ItemList',
    itemListElement: lista.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `Playa de ${p.nombre}`,
      url: abs(beachPath(p)),
    })),
  };
}

function conContexto(...nodos) {
  return { '@context': 'https://schema.org', '@graph': nodos };
}

function datosPlaya(p) {
  return (abs) =>
    conContexto(
      {
        '@type': 'Beach',
        name: `Playa de ${p.nombre}`,
        url: abs(beachPath(p)),
        geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lon },
        address: {
          '@type': 'PostalAddress',
          addressLocality: p.municipio,
          addressRegion: region.name,
          addressCountry: 'ES',
        },
        // Only attributes the catalog states, true or false; absent = unknown, omitted.
        amenityFeature: Object.entries(p.atributos ?? {})
          .filter(([clave, valor]) => typeof valor === 'boolean' && ATTR_LABELS[clave])
          .map(([clave, valor]) => ({
            '@type': 'LocationFeatureSpecification',
            name: ATTR_LABELS[clave],
            value: valor,
          })),
      },
      migas(abs, [
        ['Inicio', '/'],
        [p.municipio, municipalityPath(p.municipio)],
        [`Playa de ${p.nombre}`, beachPath(p)],
      ])
    );
}

/** Great-circle distance in km (haversine). */
function distanciaKm(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function cercanas(p, n = 4) {
  return playas
    .filter((o) => o !== p)
    .map((o) => ({ playa: o, km: distanciaKm(p, o) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}

/**
 * One prose sentence built only from catalog facts. Type, sand and access stay
 * in the lists below: they are free-form catalog text ("Dunas / humedal",
 * "En coche desde Monte") that does not read as prose once spliced in.
 */
function descripcionPlaya(p) {
  let texto = `La playa de ${p.nombre} está en ${p.municipio} (${region.name})`;
  if (p.longitud) {
    texto += ` y mide unos ${p.longitud} m de largo${p.anchura ? ` y ${p.anchura} m de ancho` : ''}`;
  }
  return `<p>${escaparHtml(`${texto}.`)}</p>`;
}

function comoLlegar(p) {
  const filas = [];
  if (Array.isArray(p.acceso) && p.acceso.length > 0) filas.push(['Acceso', p.acceso.join(' · ')]);
  if (p.parkingDescripcion) filas.push(['Parking', p.parkingDescripcion]);
  if (p.bus) filas.push(['Autobús', p.bus]);
  filas.push(['Coordenadas', `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`]);
  const mapa = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`;
  return `<h2>Cómo llegar y aparcar en ${escaparHtml(p.nombre)}</h2>
      <ul>
        ${filas.map(([k, v]) => `<li><strong>${escaparHtml(k)}:</strong> ${escaparHtml(v)}</li>`).join('\n        ')}
      </ul>
      <p><a href="${escaparHtml(mapa)}" rel="nofollow noopener">Ver la ruta en Google Maps</a></p>`;
}

/** Yes/no answers for what people search for; absent attribute = unknown, said nothing. */
function normasPlaya(p) {
  const a = p.atributos ?? {};
  const frases = [];
  if (a.mascotas === true) frases.push('Figura como apta para perros y otras mascotas.');
  if (a.mascotas === false) frases.push('No figura como playa apta para perros.');
  if (a.nudista === true) frases.push('Es una playa nudista.');
  if (a.surf === true) frases.push('Está señalada como playa para surf.');
  if (a.accesible === true) frases.push('Está marcada como accesible.');
  if (a.socorrismo === true) frases.push('Tiene puesto de socorrismo.');
  if (frases.length === 0) return '';
  const titulo = typeof a.mascotas === 'boolean' ? '¿Se admiten perros? Normas y servicios' : 'Normas y servicios';
  return `<h2>${titulo}</h2>
      <p>${escaparHtml(frases.join(' '))}</p>`;
}

function enlacesCercanas(p) {
  return `<h2>Playas cerca de ${escaparHtml(p.nombre)}</h2>
      <ul>
        ${cercanas(p)
          .map(
            ({ playa, km }) =>
              `<li><a href="${beachPath(playa)}">Playa de ${escaparHtml(playa.nombre)}</a> (${escaparHtml(playa.municipio)}, a ${km.toFixed(1)} km)</li>`
          )
          .join('\n        ')}
      </ul>`;
}

/** Static facts of a beach as list items. Only what the catalog states. */
function hechosPlaya(p) {
  const filas = [];
  if (p.tipoPlaya) filas.push(['Tipo', p.tipoPlaya]);
  if (p.arena) filas.push(['Arena', p.arena]);
  if (p.longitud) {
    filas.push(['Dimensiones', `${p.longitud} m${p.anchura ? ` × ${p.anchura} m` : ''}`]);
  }
  // Access, parking and bus live in comoLlegar(), not repeated here.
  if (p.hospitalDistancia != null) filas.push(['Hospital', `a ${p.hospitalDistancia} km`]);
  return filas
    .map(([k, v]) => `<li><strong>${escaparHtml(k)}:</strong> ${escaparHtml(v)}</li>`)
    .join('\n        ');
}

function serviciosPlaya(p) {
  const activos = Object.entries(p.atributos ?? {})
    .filter(([clave, valor]) => valor === true && ATTR_LABELS[clave])
    .map(([clave]) => ATTR_LABELS[clave]);
  if (p.submarinismo) activos.push(ATTR_LABELS.submarinismo);
  return activos.length > 0
    ? `<p><strong>Servicios:</strong> ${escaparHtml(activos.join(' · '))}</p>`
    : '';
}

const AVISO_ESTATICO =
  '<p><em>Información fija de la playa. La bandera, el tiempo y las mareas de hoy se cargan al abrir la aplicación.</em></p>';

const NAV = `<nav><a href="/">Inicio</a> · <a href="/playas">Todas las playas</a> · <a href="/municipios">Municipios</a> · <a href="/mapa">Mapa</a></nav>`;

function enlacesPlayas(lista) {
  return lista
    .map((p) => `<li><a href="${beachPath(p)}">${escaparHtml(p.nombre)} (${escaparHtml(p.municipio)})</a></li>`)
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
      <p><a href="${municipalityPath(p.municipio)}">${escaparHtml(p.municipio)}</a> · ${escaparHtml(region.name)}</p>
      ${descripcionPlaya(p)}
      ${AVISO_ESTATICO}
      <h2>Datos de la playa</h2>
      <ul>
        ${hechosPlaya(p)}
      </ul>
      ${serviciosPlaya(p)}
      ${comoLlegar(p)}
      ${normasPlaya(p)}
      ${enlacesCercanas(p)}`
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
      <p>${escaparHtml(region.branding.appName)} compara las playas de ${escaparHtml(region.name)} y elige la mejor para hoy: puntuación, bandera, tiempo y mareas al abrir la aplicación.</p>
      <h2>Playas de ${escaparHtml(region.name)} por municipio</h2>
      <p>${municipalitiesOf(playas)
        .map((m) => `<a href="${municipalityPath(m)}">${escaparHtml(m)}</a>`)
        .join(' · ')}</p>
      <h2>Todas las playas de ${escaparHtml(region.name)}</h2>
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

/**
 * The static block is written for crawlers, which read the raw HTML. A browser
 * with JS gets it replaced by the real app on mount (createRoot.render), but
 * until then it was PAINTED: the user saw a bare list of links with none of the
 * app's styles and read it as a broken page. Hiding it costs the crawler
 * nothing —the markup is still in the HTML it parses, and a crawler that does
 * render sees the mounted app, same as before.
 *
 * The class is added by script on purpose: a browser WITHOUT JS never gets the
 * app, so for it the block stays visible, which is the whole point of writing
 * it. The <style> goes in the head, so the block is hidden at the first paint
 * and there is nothing to flash.
 */
const OCULTAR_CON_JS =
  '<script>document.documentElement.classList.add("with-js")</script>\n    ' +
  '<style>html.with-js .prerender{display:none}</style>';

/** Injects head tags + title + root content into the built template. */
function paginaHtml(titulo, descripcion, ruta, contenido, datos) {
  let html = plantilla;
  const conTitulo = html.replace(/<title>[^<]*<\/title>/, () => `<title>${escaparHtml(titulo)}</title>`);
  if (conTitulo === html) {
    throw new Error('la plantilla no tiene <title>');
  }
  html = conTitulo.replace(
    '</head>',
    () => `    ${etiquetasHead(titulo, descripcion, ruta, datos)}\n    ${OCULTAR_CON_JS}\n  </head>`
  );
  const conRoot = html.replace('<div id="root"></div>', () => `<div id="root">${contenido}</div>`);
  if (conRoot === html) {
    throw new Error('la plantilla no tiene <div id="root"></div> vacío');
  }
  return conRoot;
}

function escribirRuta(ruta, titulo, descripcion, contenido, datos) {
  const html = paginaHtml(titulo, descripcion, ruta, contenido, datos);
  const destino = ruta === '/' ? plantillaHtml : join(rutaBuild, ...ruta.split('/').filter(Boolean), 'index.html');
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, html);
  return destino;
}

const vars = { region: region.name, marca: region.branding.appName };
let generadas = 0;

try {
  escribirRuta(
    '/',
    fillTemplate(SEO_TEMPLATES.tituloInicio, vars),
    fillTemplate(SEO_TEMPLATES.descInicio, vars),
    contenidoInicio()
  );
  generadas += 1;

  escribirRuta(
    '/playas',
    fillTemplate(SEO_TEMPLATES.tituloLista, vars),
    fillTemplate(SEO_TEMPLATES.descLista, vars),
    contenidoListado()
  );
  generadas += 1;

  escribirRuta(
    '/mapa',
    fillTemplate(SEO_TEMPLATES.tituloMapa, vars),
    fillTemplate(SEO_TEMPLATES.descMapa, vars),
    contenidoMapa()
  );
  generadas += 1;

  for (const p of playas) {
    escribirRuta(
      beachPath(p),
      fillTemplate(SEO_TEMPLATES.tituloDetalle, { ...vars, nombre: p.nombre, municipio: p.municipio }),
      fillTemplate(SEO_TEMPLATES.descDetalle, { ...vars, nombre: p.nombre, municipio: p.municipio }),
      contenidoPlaya(p),
      datosPlaya(p)
    );
    generadas += 1;
  }

  // Legal pages. Only the head and a summary are baked: the full text lives in
  // LegalPage.tsx and copying it here would give it a second home, free to
  // drift — and it is the text that promises how to exercise data-protection
  // rights, so two versions of it is the last thing this needs. What matters
  // is that a crawler stops receiving the HOME page's title and canonical for
  // these URLs, which is what it got until now.
  for (const [ruta, tituloKey, descKey] of [
    ['/acerca-de', 'tituloAcerca', 'descAcerca'],
    ['/privacidad', 'tituloPrivacidad', 'descPrivacidad'],
  ]) {
    const titulo = fillTemplate(SEO_TEMPLATES[tituloKey], vars);
    const descripcion = fillTemplate(SEO_TEMPLATES[descKey], vars);
    escribirRuta(
      ruta,
      titulo,
      descripcion,
      bloqueContenido(
        `<h1>${escaparHtml(titulo.split(' | ')[0])}</h1>
      <p>${escaparHtml(descripcion)}</p>
      <p><em>El texto completo se carga al abrir la aplicación.</em></p>`
      )
    );
    generadas += 1;
  }

  // Municipalities index: the global access point to the 18 pages below.
  escribirRuta(
    '/municipios',
    fillTemplate(SEO_TEMPLATES.tituloMunicipios, vars),
    fillTemplate(SEO_TEMPLATES.descMunicipios, vars),
    bloqueContenido(
      `<h1>Municipios con playa en ${escaparHtml(region.name)}</h1>
      <ul>
        ${municipalitiesSummary(playas)
          .map((m) => `<li><a href="${m.ruta}">${escaparHtml(m.municipio)}</a> (${m.total})</li>`)
          .join('\n        ')}
      </ul>`
    )
  );
  generadas += 1;

  // Phase 6: municipality pages — one per municipality in the catalog.
  for (const municipio of municipalitiesOf(playas)) {
    const ruta = municipalityPath(municipio);
    const propias = beachesOfMunicipalitySlug(playas, ruta.split('/')[2]);
    escribirRuta(
      ruta,
      fillTemplate(SEO_TEMPLATES.tituloMunicipio, { ...vars, municipio }),
      fillTemplate(SEO_TEMPLATES.descMunicipio, { ...vars, municipio }),
      bloqueContenido(
        `<h1>Playas de ${escaparHtml(municipio)}</h1>
      <p>${escaparHtml(municipio)} · ${escaparHtml(region.name)}</p>
      <ul>
        ${enlacesPlayas(propias)}
      </ul>
      ${AVISO_ESTATICO}`
      ),
      (abs) =>
        conContexto(
          migas(abs, [
            ['Inicio', '/'],
            ['Municipios', '/municipios'],
            [`Playas de ${municipio}`, ruta],
          ]),
          listaPlayas(abs, propias)
        )
    );
    generadas += 1;
  }

  // Phase 6: curated landings — empty categories are never published.
  for (const landing of nonEmptyLandings(playas)) {
    const titulo = fillTemplate(landing.textos.titulo, vars);
    const intro = fillTemplate(landing.textos.intro, vars);
    const propias = playas.filter(landing.filtro);
    escribirRuta(
      `/${landing.id}`,
      `${titulo} | ${region.branding.appName}`,
      intro,
      bloqueContenido(
        `<h1>${escaparHtml(titulo)}</h1>
      <p>${escaparHtml(intro)}</p>
      <ul>
        ${enlacesPlayas(propias)}
      </ul>`
      ),
      (abs) =>
        conContexto(
          migas(abs, [
            ['Inicio', '/'],
            [titulo, `/${landing.id}`],
          ]),
          listaPlayas(abs, propias)
        )
    );
    generadas += 1;
  }
} catch (e) {
  console.error(`[prerender] FALLO generando rutas: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}

// The count must be exact: a silently skipped beach is a missing page.
// 4 fixed (home, list, map, municipalities index) + 2 legal.
const esperadas =
  6 + playas.length + municipalitiesOf(playas).length + nonEmptyLandings(playas).length;
if (generadas !== esperadas) {
  console.error(`[prerender] generadas ${generadas} rutas, esperadas ${esperadas}.`);
  process.exit(1);
}

console.log(
  `[prerender] ${generadas} rutas generadas en build/ (${origen ?? 'sin origen público: sin canónicas absolutas'})`
);

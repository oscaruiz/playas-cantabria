/**
 * Canonical beach URLs — the ONE place slugs are generated. Everything that
 * needs a beach URL (pages, SeoHead, the sitemap generator) goes through
 * here; nobody re-implements slugging.
 *
 * CommonJS on purpose: this file is imported by the CRA/TypeScript app
 * (allowJs) AND executed by plain Node in `scripts/generate-sitemap.mjs`
 * via createRequire. TS 4.9 under CRA cannot resolve an .mjs inside src,
 * and Node without "type": "module" cannot import an ESM .js — CJS is the
 * one dialect every consumer understands.
 *
 * The slug is DERIVED from the catalog's nombre/municipio. That makes it
 * deterministic for a given catalog, and it makes collisions (two beaches
 * mapping to the same route) a data error: `detectarColisiones` reports
 * them and the sitemap generator fails the build, so a collision can never
 * reach production silently. `codigo` remains the permanent identity — the
 * legacy route /playas/:codigo keeps working forever.
 */

'use strict';

/**
 * NFD + the combining-marks block, NOT `\p{M}`: with Firefox 70 in
 * browserslist, Babel expands a `\p{…}` escape into ~4 kB of Unicode
 * ranges — measured, it alone blew the bundle budget. U+0300–U+036F is
 * exactly what NFD emits for Latin names (á, ñ, ü, à…), which is all a
 * Spanish beach catalog contains.
 * @param {string} texto
 * @returns {string} the text without diacritics
 */
function sinAcentos(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Lowercase, accents stripped, every non-alphanumeric run collapsed to a
 * single dash. "L'Escala" → "l-escala", "La Arnía" → "la-arnia",
 * "Peñacastillo" → "penacastillo".
 * @param {string} texto
 * @returns {string}
 */
function slugify(texto) {
  return sinAcentos(texto.toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Canonical route of a beach: /playas/<municipio>/<nombre>, both slugged.
 * @param {{ nombre: string, municipio: string }} playa
 * @returns {string}
 */
function rutaPlaya(playa) {
  return `/playas/${slugify(playa.municipio)}/${slugify(playa.nombre)}`;
}

/**
 * Resolves the beach a canonical URL points at, or undefined.
 * @template {{ nombre: string, municipio: string }} P
 * @param {P[]} playas
 * @param {string} municipioSlug
 * @param {string} playaSlug
 * @returns {P | undefined}
 */
function encontrarPorSlugs(playas, municipioSlug, playaSlug) {
  return playas.find(
    (p) => slugify(p.municipio) === municipioSlug && slugify(p.nombre) === playaSlug
  );
}

/**
 * Routes shared by more than one beach, plus beaches whose name slugs to
 * nothing. Either one is a catalog problem that must fail the build.
 * @param {Array<{ nombre: string, municipio: string, codigo: string }>} playas
 * @returns {Array<{ ruta: string, codigos: string[] }>}
 */
function detectarColisiones(playas) {
  const porRuta = new Map();
  for (const p of playas) {
    const ruta = slugify(p.nombre) === '' ? '(slug vacío)' : rutaPlaya(p);
    const lista = porRuta.get(ruta) ?? [];
    lista.push(p.codigo);
    porRuta.set(ruta, lista);
  }
  const conflictos = [];
  porRuta.forEach((codigos, ruta) => {
    if (codigos.length > 1 || ruta === '(slug vacío)') {
      conflictos.push({ ruta, codigos });
    }
  });
  return conflictos;
}

module.exports = { sinAcentos, slugify, rutaPlaya, encontrarPorSlugs, detectarColisiones };

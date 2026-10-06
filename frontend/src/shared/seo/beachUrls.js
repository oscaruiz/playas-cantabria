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
 * mapping to the same route) a data error: `detectCollisions` reports
 * them and the sitemap generator fails the build, so a collision can never
 * reach production silently. `codigo` remains the permanent identity — the
 * legacy route /playas/:codigo keeps working forever.
 */

/* eslint-env node, commonjs */
'use strict';

/**
 * NFD + the combining-marks block, NOT `\p{M}`: with Firefox 70 in
 * browserslist, Babel expands a `\p{…}` escape into ~4 kB of Unicode
 * ranges — measured, it alone blew the bundle budget. U+0300–U+036F is
 * exactly what NFD emits for Latin names (á, ñ, ü, à…), which is all a
 * Spanish beach catalog contains.
 * @param {string} text
 * @returns {string} the text without diacritics
 */
function withoutAccents(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Lowercase, accents stripped, every non-alphanumeric run collapsed to a
 * single dash. "L'Escala" → "l-escala", "La Arnía" → "la-arnia",
 * "Peñacastillo" → "penacastillo".
 * @param {string} text
 * @returns {string}
 */
function slugify(text) {
  return withoutAccents(text.toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Canonical route of a beach: /playas/<municipio>/<nombre>, both slugged.
 * @param {{ nombre: string, municipio: string }} beach
 * @returns {string}
 */
function beachPath(beach) {
  return `/playas/${slugify(beach.municipio)}/${slugify(beach.nombre)}`;
}

/**
 * Resolves the beach a canonical URL points at, or undefined.
 * @template {{ nombre: string, municipio: string }} P
 * @param {P[]} beaches
 * @param {string} municipalitySlug
 * @param {string} beachSlug
 * @returns {P | undefined}
 */
function findBySlugs(beaches, municipalitySlug, beachSlug) {
  return beaches.find(
    (p) => slugify(p.municipio) === municipalitySlug && slugify(p.nombre) === beachSlug
  );
}

/**
 * Routes shared by more than one beach, plus beaches whose name slugs to
 * nothing. Either one is a catalog problem that must fail the build.
 * @param {Array<{ nombre: string, municipio: string, codigo: string }>} beaches
 * @returns {Array<{ ruta: string, codigos: string[] }>}
 */
function detectCollisions(beaches) {
  const byPath = new Map();
  for (const p of beaches) {
    const path = slugify(p.nombre) === '' ? '(slug vacío)' : beachPath(p);
    const list = byPath.get(path) ?? [];
    list.push(p.codigo);
    byPath.set(path, list);
  }
  const conflicts = [];
  byPath.forEach((codes, path) => {
    if (codes.length > 1 || path === '(slug vacío)') {
      conflicts.push({ ruta: path, codigos: codes });
    }
  });
  return conflicts;
}

module.exports = { withoutAccents, slugify, beachPath, findBySlugs, detectCollisions };

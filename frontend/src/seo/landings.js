/**
 * Municipality and curated landing pages — the shared selectors (Phase 6).
 *
 * Both the React pages and the prerender/sitemap scripts import THIS module,
 * so a landing can never list different beaches in the app and in the
 * generated HTML (the plan's "shared selectors, not duplicated arrays").
 * CommonJS for the same reason as ./beachUrls.js.
 *
 * "Playas para familias" is deliberately ABSENT: the catalog has no
 * family-suitability field, and deriving one from other attributes would be
 * an undocumented editorial judgement (audit §3). It can join when the
 * catalog gains a real field.
 *
 * All predicates read STATIC catalog data only. No landing claims a live
 * condition; the live data belongs to each beach's detail page.
 */

/* eslint-env node, commonjs */
'use strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires -- CJS on purpose (see header)
const { slugify, rutaPlaya } = require('./beachUrls');

/** Webcam exists and is not editorially disabled (mirror of webcamDisponible). */
function conWebcam(p) {
  return Boolean(p.webcam) && p.webcam.estado !== 'desactivada';
}

/** Explicitly marked accessible. Absent attribute = unknown, NOT false → excluded. */
function esAccesible(p) {
  return p.atributos?.accesible === true;
}

/**
 * A lifeguard post is registered for the beach. Catalog-level mirror of the
 * flagAggregation convention: a station with id > 0, or idCruzRoja > 0
 * ("0 = no coverage").
 */
function conSocorrista(p) {
  if ((p.cruzRojaStations ?? []).some((e) => typeof e.id === 'number' && e.id > 0)) return true;
  return (p.idCruzRoja ?? 0) > 0;
}

/** Explicitly marked for surf. */
function paraSurf(p) {
  return p.atributos?.surf === true;
}

/**
 * The curated landings. `textos` is the Spanish single source: i18n/es.ts
 * imports it for the `landing.*` keys and the prerender script bakes it.
 */
const LANDINGS = [
  {
    id: 'playas-con-webcam',
    filtro: conWebcam,
    textos: {
      titulo: 'Playas con webcam en {region}',
      intro:
        'Playas de {region} con webcam pública para ver la zona antes de ir. El enlace abre el servicio externo de cada cámara; la app no comprueba si emite.',
    },
  },
  {
    id: 'playas-accesibles',
    filtro: esAccesible,
    textos: {
      titulo: 'Playas accesibles en {region}',
      intro:
        'Playas del catálogo de {region} marcadas como accesibles. Es información fija de la playa: los servicios pueden ser estacionales.',
    },
  },
  {
    id: 'playas-con-socorrista',
    filtro: conSocorrista,
    textos: {
      titulo: 'Playas con socorrismo en {region}',
      intro:
        'Playas de {region} con puesto de socorrismo registrado. La bandera y el horario de hoy se cargan en la ficha de cada playa.',
    },
  },
  {
    id: 'playas-para-surf',
    filtro: paraSurf,
    textos: {
      titulo: 'Playas para surf en {region}',
      intro:
        'Playas del catálogo de {region} señaladas para surf. El estado del mar de hoy se consulta en la ficha de cada playa.',
    },
  },
];

/** Landings with at least one beach: empty categories are never published. */
function landingsNoVacias(playas) {
  return LANDINGS.filter((l) => playas.some(l.filtro));
}

/** Unique municipality names, alphabetical. */
function municipiosDe(playas) {
  return Array.from(new Set(playas.map((p) => p.municipio))).sort((a, b) => a.localeCompare(b));
}

function rutaMunicipio(municipio) {
  return `/municipios/${slugify(municipio)}`;
}

/**
 * One row per municipality: name, canonical route and beach count. The
 * /municipios index (app page and prerendered file) is built from THIS,
 * so both always agree.
 */
function resumenMunicipios(playas) {
  return municipiosDe(playas).map((municipio) => ({
    municipio,
    ruta: rutaMunicipio(municipio),
    total: playas.filter((p) => p.municipio === municipio).length,
  }));
}

/** Beaches of the municipality a slug points at (empty array if unknown). */
function playasDeMunicipioSlug(playas, municipioSlug) {
  return playas.filter((p) => slugify(p.municipio) === municipioSlug);
}

module.exports = {
  LANDINGS,
  landingsNoVacias,
  municipiosDe,
  rutaMunicipio,
  resumenMunicipios,
  playasDeMunicipioSlug,
  rutaPlaya,
};

/**
 * SEO text templates — the single source for page titles and descriptions.
 *
 * Consumed from BOTH sides of the build: `i18n/es.ts` imports the templates
 * for its `seo.*` keys (the app renders them through t(), which interpolates
 * `{region}` etc.), and `scripts/prerender.mjs` fills them in plain Node to
 * bake the same text into the generated HTML. One copy, no drift.
 *
 * CommonJS for the same reason as ./beachUrls.js: CRA/TS, Jest and plain
 * Node must all load it. Spanish only — prerendered pages are published in
 * the product's base language; en.ts keeps its own English strings.
 */

/* eslint-env node, commonjs */
'use strict';

const PLANTILLAS_SEO = {
  tituloInicio: '{marca}: la mejor playa para hoy',
  descInicio:
    'Compara las playas de {region} ahora mismo: puntuación, bandera, tiempo y previsión para elegir playa hoy.',
  tituloLista: 'Todas las playas de {region} | {marca}',
  descLista:
    'Listado completo de las playas de {region}, con buscador, distancia, banderas y servicios.',
  tituloMapa: 'Mapa de playas de {region} | {marca}',
  descMapa: 'Mapa interactivo con todas las playas de {region} y su estado.',
  tituloDetalle: '{nombre}: bandera, tiempo y mareas hoy | {marca}',
  descDetalle:
    'Estado de la playa de {nombre}, en {municipio}: bandera actual, tiempo, previsión y mareas de hoy.',
  tituloMunicipio: 'Playas de {municipio}: estado actual | {marca}',
  descMunicipio:
    'Las playas de {municipio}, en {region}, con enlace al estado de hoy de cada una: bandera, tiempo y mareas.',
  tituloAcerca: 'Acerca de y condiciones | {marca}',
  descAcerca:
    'Qué es {marca}, su independencia, límites de responsabilidad, fuentes de datos y contacto.',
  tituloPrivacidad: 'Privacidad y almacenamiento | {marca}',
  descPrivacidad:
    'Qué datos trata {marca}: geolocalización opcional, almacenamiento local, proveedores y derechos.',
  tituloMunicipios: 'Municipios con playa en {region} | {marca}',
  descMunicipios:
    'Todos los municipios de {region} con playa en el catálogo, con acceso a las playas de cada uno.',
};

/**
 * Spanish labels of the catalog's boolean attributes, keyed exactly like
 * `atributos.*`. Shared by `i18n/es.ts` (the `attr.*` keys) and the
 * prerender script ("Servicios: Duchas · Parking …").
 */
const ETIQUETAS_ATTR = {
  duchas: 'Duchas',
  aseos: 'Aseos',
  parking: 'Parking',
  accesible: 'Accesible',
  chiringuito: 'Chiringuito',
  surf: 'Surf',
  mascotas: 'Mascotas',
  socorrismo: 'Socorrismo',
  nudista: 'Nudista',
  accesoBanista: 'Acceso baño',
  submarinismo: 'Submarinismo',
};

/**
 * Same `{placeholder}` syntax as IdiomaContext's interpolar: unknown
 * placeholders are left as-is, never emptied.
 * @param {string} plantilla
 * @param {Record<string, string | number>} vars
 * @returns {string}
 */
function rellenar(plantilla, vars) {
  return plantilla.replace(/\{(\w+)\}/g, (original, nombre) =>
    vars[nombre] != null ? String(vars[nombre]) : original
  );
}

module.exports = { PLANTILLAS_SEO, ETIQUETAS_ATTR, rellenar };

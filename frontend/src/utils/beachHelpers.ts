/**
 * Shared beach helper functions used by HomePage, PlayaDetalle, and other pages.
 */

import {
  waterOutline,
  maleFemaleOutline,
  carOutline,
  accessibilityOutline,
  restaurantOutline,
  pawOutline,
  medkitOutline,
  fishOutline,
  walkOutline,
  bodyOutline,
} from 'ionicons/icons';
import type { ClaveTexto } from '../shared/i18n/es';
import { sinAcentos } from '../shared/seo/beachUrls';
import { fechaMadrid, minutosMadrid } from '../shared/format/tiempo';

/** Normalizes for search: lowercase + no accents (Arn\u00EDa \u2192 arnia). */
export function normalizarBusqueda(texto: string): string {
  // Shares the accent-stripper with the URL module: the previous inline
  // `\p{M}` regex cost ~4 kB of bundle once Babel expanded it (see
  // seo/beachUrls.js).
  return sinAcentos(texto.toLowerCase());
}

/**
 * Does the beach match the search term? Searches (ignoring accents) in
 * `nombre`, `municipio` and `alias`, so that a canonical name or an alias (place name,
 * sector or Cruz Roja station name) finds the beach without duplicating results.
 */
export function coincidePlaya(
  p: { nombre: string; municipio: string; alias?: string[] },
  termino: string
): boolean {
  const t = normalizarBusqueda(termino);
  if (normalizarBusqueda(p.nombre).includes(t) || normalizarBusqueda(p.municipio).includes(t)) {
    return true;
  }
  return (p.alias ?? []).some((a) => normalizarBusqueda(a).includes(t));
}

export function flagColorClass(bandera?: string): string {
  const b = bandera?.toLowerCase() || '';
  if (b.includes('negra')) return 'black';
  if (b.includes('roja')) return 'red';
  if (b.includes('amarilla')) return 'yellow';
  if (b.includes('verde')) return 'green';
  return 'unknown';
}

export function isFlagAvailable(cruzRoja?: { bandera?: string }): boolean {
  if (!cruzRoja) return false;
  const b = cruzRoja.bandera?.toLowerCase() || '';
  return b.includes('negra') || b.includes('roja') || b.includes('amarilla') || b.includes('verde');
}

export type EstadoBandera = 'color' | 'fueraDeHorario' | 'sinDatos';

/** Converts "DD-MM-YYYY" (Cruz Roja format) to "YYYY-MM-DD"; null if it doesn't parse. */
function isoDesdeDDMMYYYY(fecha?: string | null): string | null {
  if (!fecha) return null;
  const m = fecha.match(/(\d{2})-(\d{2})-(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Freshness window: a flag older than this is not shown on ANY screen.
 *
 * ONE number for both the flag in force and the last recorded one: they are
 * the same question — how old may a colour be and still be painted — and two
 * numbers meant the detail could still show a flag the home page had already
 * dropped. Mirror of `MAX_EDAD_BANDERA_MS` in flagVigencia.ts; keep in sync.
 */
const MAX_EDAD_BANDERA_MS = 8 * 60 * 60 * 1000; // 8h — mirror of flagVigencia.ts

/**
 * Is the flag capture (ISO) recent (≤8h)?
 * If the ISO doesn't parse, it is assumed fresh (lenient) so as not to hide good data.
 */
export function esInfoReciente(iso: string, ahora: Date = new Date()): boolean {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return true;
  return ahora.getTime() - ms <= MAX_EDAD_BANDERA_MS;
}

/**
 * Are we within the lifeguard hours (and season), in Madrid time?
 * Returns null if there is no schedule data to decide.
 */
export function dentroDeHorario(
  cruzRoja?: { horario?: string | null; coberturaDesde?: string | null; coberturaHasta?: string | null },
  ahora: Date = new Date()
): boolean | null {
  if (!cruzRoja?.horario) return null;
  const m = cruzRoja.horario.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;

  // Out of season (coverage) → no service even if it's mid-afternoon.
  const hoy = fechaMadrid(ahora);
  const desde = isoDesdeDDMMYYYY(cruzRoja.coberturaDesde);
  const hasta = isoDesdeDDMMYYYY(cruzRoja.coberturaHasta);
  if (desde && hoy < desde) return false;
  if (hasta && hoy > hasta) return false;

  const cur = minutosMadrid(ahora);
  const ini = +m[1] * 60 + +m[2];
  const fin = +m[3] * 60 + +m[4];
  return cur >= ini && cur <= fin;
}

/**
 * State to display for the Cruz Roja flag:
 *  - 'color'          → real flag hoisted and current (green/yellow/red)
 *  - 'fueraDeHorario' → outside the lifeguard hours/season
 *  - 'sinDatos'       → within hours but without a fresh flag (no recent
 *                       capture or no known schedule)
 *
 * The flag is only painted with color if it is CURRENT: within hours/season AND
 * with recent data (≤8h). A color from an older capture no longer reflects what
 * is flying now → it is not shown.
 * MIRROR of the backend: same rule in `domain/services/flagVigencia.ts`, whose
 * `vigenciaBandera` draws the same three states ('sin-servicio' / 'caducada').
 */
export function estadoBandera(
  cruzRoja?: { bandera?: string; horario?: string | null; coberturaDesde?: string | null; coberturaHasta?: string | null; ultimaActualizacion?: string | null },
  ahora: Date = new Date()
): EstadoBandera {
  if (dentroDeHorario(cruzRoja, ahora) === false) return 'fueraDeHorario';
  const fresca = cruzRoja?.ultimaActualizacion
    ? esInfoReciente(cruzRoja.ultimaActualizacion, ahora)
    : true;
  if (isFlagAvailable(cruzRoja) && fresca) return 'color';
  return 'sinDatos';
}

/**
 * Last recorded flag, to show it OUTSIDE lifeguard hours (when there is no longer
 * a current flag to paint). Returns the latest moment it could have been
 * flying: Cruz Roja keeps its page published all night, so a
 * capture after closing is clamped to that day's closing time — we never say
 * "2 minutes ago" in the early morning.
 *
 * null if there is no color, if we are still within hours, if the schedule is
 * unknown, if the record falls outside the coverage season, or if it is older
 * than the freshness window (then the detail keeps showing plain "Fuera de
 * horario", with no colour).
 */
export function ultimaBanderaRegistrada(
  cruzRoja?: {
    bandera?: string;
    horario?: string | null;
    coberturaDesde?: string | null;
    coberturaHasta?: string | null;
    ultimaActualizacion?: string | null;
  },
  ahora: Date = new Date()
): { bandera: string; registradaIso: string } | null {
  if (!isFlagAvailable(cruzRoja) || dentroDeHorario(cruzRoja, ahora) !== false) return null;

  const captura = cruzRoja?.ultimaActualizacion ? new Date(cruzRoja.ultimaActualizacion) : null;
  if (!captura || Number.isNaN(captura.getTime())) return null;

  const m = cruzRoja!.horario!.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const ini = +m[1] * 60 + +m[2];
  const fin = +m[3] * 60 + +m[4];

  // Clamp the capture to the closing of the lifeguard day it belongs to.
  const capturaMin = minutosMadrid(captura);
  let registrada = captura.getTime();
  if (capturaMin > fin) registrada -= (capturaMin - fin) * 60000; // closed that same day
  else if (capturaMin < ini) registrada -= (capturaMin + 1440 - fin) * 60000; // closed the previous day

  if (ahora.getTime() - registrada > MAX_EDAD_BANDERA_MS) return null;

  // A record outside the coverage season does not correspond to real lifeguarding.
  const dia = fechaMadrid(new Date(registrada));
  const desde = isoDesdeDDMMYYYY(cruzRoja?.coberturaDesde);
  const hasta = isoDesdeDDMMYYYY(cruzRoja?.coberturaHasta);
  if ((desde && dia < desde) || (hasta && dia > hasta)) return null;

  return { bandera: cruzRoja!.bandera!, registradaIso: new Date(registrada).toISOString() };
}

/** Does the beach have a showable webcam? (it exists and is not deactivated). */
export function webcamDisponible(
  webcam?: { estado?: 'activa' | 'desactivada' } | null
): boolean {
  return !!webcam && webcam.estado !== 'desactivada';
}

/**
 * Does the beach have a lifeguard flag service?
 *
 * For DTOs without `fuenteBanderas`, both legacy sources must be consulted
 * because `src/data/beaches.json` (the local
 * fallback) is the raw repository file, not the DTO: 32 of the 46 beaches
 * only carry `cruzRojaStations`. The backend does derive an `idCruzRoja` from
 * the first station with an id (`JsonBeachRepository.mapToEntity`), so looking
 * only at that field the badge appeared with the backend and disappeared with the fallback.
 *
 * MIRROR of the backend: same order of preference as
 * `domain/services/flagAggregation.ts` → `resolveFlagForStations`.
 */
export function vigilanciaDisponible(
  playa?: {
    fuenteBanderas?: string | null;
    idCruzRoja?: number;
    cruzRojaStations?: Array<{ id?: number }>;
  } | null
): boolean {
  // The explicit operator from current DTOs is authoritative. Consult the
  // Cruz Roja fields only for old backends and the local fallback catalog.
  if (playa?.fuenteBanderas !== undefined) {
    return playa.fuenteBanderas !== null;
  }

  const conPuesto = (playa?.cruzRojaStations ?? []).some(
    (p) => typeof p.id === 'number' && p.id > 0
  );
  if (conPuesto) return true;
  return (playa?.idCruzRoja ?? 0) > 0;
}

/**
 * Operator that must be named in the UI ("Vigilada por X"), or null when
 * nothing watches the beach and the flag section has to disappear.
 *
 * The absent field is NOT the same as null: the local fallback catalog and the
 * backend deployed before this feature simply do not report the operator, and
 * for them the answer is the one that was always shown. Remove
 * `OPERADOR_LEGADO` once no such client is left.
 */
const OPERADOR_LEGADO = 'Cruz Roja';

export function operadorVigilancia(
  playa?: { fuenteBanderas?: string | null } | null
): string | null {
  if (!playa || playa.fuenteBanderas === undefined) return OPERADOR_LEGADO;
  return playa.fuenteBanderas;
}

export type CoberturaWebcam = 'exacta' | 'compartida' | 'cercana';

/**
 * i18n key for a webcam's title/label according to its coverage. The label is
 * the honest signal to the user: a shared or nearby camera is NEVER presented
 * as exact. Returns a `ClaveTexto` to pass to `t()`.
 */
export function claveCoberturaWebcam(cobertura: CoberturaWebcam): ClaveTexto {
  switch (cobertura) {
    case 'compartida':
      return 'webcam.vistaPanoramica';
    case 'cercana':
      return 'webcam.cercana';
    case 'exacta':
    default:
      return 'webcam.enDirecto';
  }
}

/** Waves glyph for "surf" (doesn't exist in Ionicons) \u2014 same data-URI format as ionicons */
const olasIcon =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><path d='M48 192c48-44 112-44 160 0s112 44 160 0 88-38 96-42' fill='none' stroke='currentColor' stroke-width='32' stroke-linecap='round'/><path d='M48 320c48-44 112-44 160 0s112 44 160 0 88-38 96-42' fill='none' stroke='currentColor' stroke-width='32' stroke-linecap='round'/></svg>";

export const ATTR_CONFIG: Record<string, { emoji: string; icon: string; label: string }> = {
  duchas:        { emoji: '\u{1F6BF}', icon: waterOutline, label: 'Duchas' },
  aseos:         { emoji: '\u{1F6BB}', icon: maleFemaleOutline, label: 'Aseos' },
  parking:       { emoji: '\u{1F17F}\uFE0F', icon: carOutline, label: 'Parking' },
  accesible:     { emoji: '\u267F', icon: accessibilityOutline, label: 'Accesible' },
  chiringuito:   { emoji: '\u{1F379}', icon: restaurantOutline, label: 'Chiringuito' },
  surf:          { emoji: '\u{1F3C4}', icon: olasIcon, label: 'Surf' },
  mascotas:      { emoji: '\u{1F415}', icon: pawOutline, label: 'Mascotas' },
  socorrismo:    { emoji: '\u{1F6DF}', icon: medkitOutline, label: 'Socorrismo' },
  nudista:       { emoji: '\u{1F3D6}\uFE0F', icon: bodyOutline, label: 'Nudista' },
  accesoBanista: { emoji: '\u{1F3CA}', icon: walkOutline, label: 'Acceso ba\u00F1o' },
  submarinismo: { emoji: '\u{1F93F}', icon: fishOutline, label: 'Submarinismo' },
};

/** Returns active attribute entries from a beach's atributos object */
export function getActiveAttrs(atributos?: Record<string, boolean | undefined> | null): Array<{ key: string; emoji: string; icon: string; label: string }> {
  if (!atributos) return [];
  return Object.entries(atributos)
    .filter(([key, val]) => val === true && ATTR_CONFIG[key])
    .map(([key]) => ({ key, ...ATTR_CONFIG[key] }));
}

/**
 * Is there active rain right now? Priority: structured signal from the backend
 * (`lluvia.estado`, multi-source) → observed mm → regex over the sky
 * text (fallback for old backends without the field).
 */
export function esLluviaActiva(
  tiempoActual?: {
    cielo?: string | null;
    precipitacionMm?: number | null;
    lluvia?: { estado: string } | null;
  } | null
): boolean {
  if (!tiempoActual) return false;
  if (tiempoActual.lluvia?.estado === 'lloviendo') return true;
  if (tiempoActual.lluvia?.estado === 'sin_lluvia') return false;
  if ((tiempoActual.precipitacionMm ?? 0) > 0) return true;
  const c = (tiempoActual.cielo ?? '').toLowerCase();
  return /lluvia|llovizna|chubasc|tormenta/.test(c);
}

/**
 * FORECAST rain to display. Returns null if it is already raining (the active
 * rain badge has priority — never two badges at once) or if there is no signal.
 */
export function lluviaPrevista(
  tiempoActual?: {
    cielo?: string | null;
    precipitacionMm?: number | null;
    lluvia?: { estado: string; prevista?: { desdeIso: string | null; mm: number | null; fuentes: string[] } | null } | null;
  } | null
): { desdeIso: string | null; mm: number | null; fuentes: string[] } | null {
  if (!tiempoActual) return null;
  if (esLluviaActiva(tiempoActual)) return null;
  return tiempoActual.lluvia?.prevista ?? null;
}

export function emojiCielo(cielo: string | null, esNoche = false): string {
  if (!cielo) return esNoche ? '\u{1F319}' : '\u26C5';
  const c = cielo.toLowerCase();

  // Significant weather goes FIRST. AEMET puts cloud cover and
  // precipitation in the same string ("Cubierto con lluvia", "Intervalos
  // nubosos con lluvia escasa"), so checking cloudiness first meant rain
  // never showed: those two gave cloud and sun respectively.
  // 'torment', not 'tormenta', so that "chubascos tormentosos" also matches.
  if (/torment|el[eé]ctrica|rayos/.test(c)) return '\u26C8\uFE0F';
  if (/nieve|nevada|aguanieve/.test(c)) return '\u{1F328}\uFE0F';
  if (/lluvia|llovizna|chubascos/.test(c)) return '\u{1F327}\uFE0F';
  if (/niebla|bruma|neblina/.test(c)) return '\u{1F32B}\uFE0F';

  // At night a sun is simply wrong, and there is no widely supported
  // moon-behind-cloud emoji: clear and partly clear both become the moon.
  // Nothing is lost — `palabraCielo` still tells them apart in words.
  if (esNoche && /poco nuboso|intervalos|parcial|nubes dispersas|algo de nubes|despejado|soleado|claro/.test(c)) {
    return '\u{1F319}';
  }

  // Cloud cover, from least to most. Partials go BEFORE clear so
  // that the 'soleado' in "parcialmente soleado" doesn't take it.
  if (/poco nuboso|intervalos|parcial|nubes dispersas|algo de nubes/.test(c)) return '\u{1F324}\uFE0F';
  // "cielo claro" is OpenWeather's clear sky (01x); AEMET says "despejado".
  if (/despejado|soleado|claro/.test(c)) return '\u2600\uFE0F';
  // Plain "nubes" is OpenWeather's overcast (04x); scattered ones have already been filtered above.
  if (/muy nuboso|cubierto|nubes/.test(c)) return '\u2601\uFE0F';
  if (/nuboso|nublado/.test(c)) return '\u26C5';
  return '\u26C5';
}

/**
 * The app's own word for a sky, whatever the provider called it.
 *
 * The listing and the detail were describing the SAME sky with two
 * vocabularies: the ranking reason said "Sol" or "Parcialmente soleado"
 * (normalized in the backend, because AEMET and OpenWeather do not name
 * skies alike) while the detail headline printed the provider's raw string \u2014
 * "cielo claro", "algo de nubes", "nubes dispersas". On 46 of 46 beaches the
 * two screens used different words, and both appear TOGETHER on the detail:
 * the score card with one, the headline with the other.
 *
 * Normalizing here and not in the API keeps `cielo` carrying what the
 * provider actually said \u2014 `emojiCielo` classifies on that raw text, and so
 * does the backend's scorer. This is a presentation problem, so it is fixed
 * at presentation.
 *
 * Returns null for a sky it does not recognize, so the caller shows the raw
 * text rather than dropping information.
 */
/**
 * Whether a ranked beach's reading is at NIGHT, per the provider's own icon
 * suffix (`01d` / `01n`). It lives here so every surface asks the same
 * question the same way: the listing, the map and the home card all render a
 * sky and all used to draw a sun at 3 a.m.
 *
 * The detail does not go through here — its observation carries an explicit
 * `esNoche`, because `iconToLegacy` drops the suffix on that path.
 */
export function esNocheEn(weather?: { iconoClima?: string | null } | null): boolean {
  return weather?.iconoClima?.endsWith('n') === true;
}

export function palabraCielo(
  cielo: string | null | undefined,
  esNoche = false,
): string | null {
  if (!cielo) return null;
  const c = cielo.toLowerCase();

  // Significant weather FIRST, same trap as `emojiCielo`: AEMET packs cover
  // and precipitation into one string ("Cubierto con lluvia"), so checking
  // cloudiness first would report a cloudy sky on a rainy one.
  if (/torment|el[e\u00E9]ctrica|rayos/.test(c)) return 'Tormenta';
  if (/nieve|nevada|aguanieve/.test(c)) return 'Nieve';
  if (/lluvia|llovizna|chubasc/.test(c)) return 'Lluvia';
  if (/niebla|bruma|neblina/.test(c)) return 'Niebla';

  // Partials BEFORE clear, or the "soleado" in "parcialmente soleado" wins.
  if (/poco nuboso|intervalos|parcial|nubes dispersas|algo de nubes/.test(c)) {
    return esNoche ? 'Parcialmente despejado' : 'Parcialmente soleado';
  }
  // At night there is no sun to name: the same sky is "Despejado".
  if (/despejado|soleado|claro/.test(c)) return esNoche ? 'Despejado' : 'Sol';
  if (/muy nuboso|cubierto|nuboso|nublado|nubes/.test(c)) return 'Nublado';
  return null;
}

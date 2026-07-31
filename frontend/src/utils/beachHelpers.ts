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
import type { TraducirFn } from '../i18n/IdiomaContext';
import type { ClaveTexto } from '../i18n/es';

export function limpiarTexto(texto: string | null | undefined): string {
  if (!texto) return '';
  return texto.replace(/\uFFFD/g, 'e');
}

/** Normalizes for search: lowercase + no accents (Arn\u00EDa \u2192 arnia). */
export function normalizarBusqueda(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
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

/** Minutes elapsed in the day in Madrid time (robust to the device's TZ). */
function minutosMadrid(fecha: Date): number {
  const hhmm = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha);
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** "YYYY-MM-DD" date in Madrid, to compare against the season coverage. */
export function fechaMadrid(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha); // en-CA → "YYYY-MM-DD"
}

/** Converts "DD-MM-YYYY" (Cruz Roja format) to "YYYY-MM-DD"; null if it doesn't parse. */
function isoDesdeDDMMYYYY(fecha?: string | null): string | null {
  if (!fecha) return null;
  const m = fecha.match(/(\d{2})-(\d{2})-(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Freshness window: a capture older than this is no longer shown. */
const MAX_EDAD_BANDERA_MS = 24 * 60 * 60 * 1000; // 24h — mirror of flagVigencia.ts

/**
 * Is the flag capture (ISO) recent (≤24h)?
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
 * with recent data (≤24h). A color from an older capture no longer reflects what
 * is flying now → it is not shown.
 * MIRROR of the backend: same rule in `application/mappers/flagVigencia.ts`.
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

/** Maximum age of the last recorded flag: the current lifeguard day or the previous one. */
const MAX_EDAD_ULTIMA_BANDERA_MS = 36 * 60 * 60 * 1000; // 36h

/**
 * Last recorded flag, to show it OUTSIDE lifeguard hours (when there is no longer
 * a current flag to paint). Returns the latest moment it could have been
 * flying: Cruz Roja keeps its page published all night, so a
 * capture after closing is clamped to that day's closing time — we never say
 * "2 minutes ago" in the early morning.
 *
 * null if there is no color, if we are still within hours, if the schedule is
 * unknown, if the record falls outside the coverage season, or if it is older
 * than ~36h (then the detail keeps showing plain "Fuera de horario").
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

  if (ahora.getTime() - registrada > MAX_EDAD_ULTIMA_BANDERA_MS) return null;

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

/**
 * "updated X ago" (min / hours / days) from an ISO or epoch ms.
 * Returns '' if it doesn't parse. Reuses the `tiempo.*` i18n keys.
 */
export function formatearHaceTiempo(input: string | number, t: TraducirFn): string {
  const ms = typeof input === 'number' ? input : new Date(input).getTime();
  if (!ms || Number.isNaN(ms)) return '';
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return t('tiempo.ahoraMismo');
  if (min < 60) return t('tiempo.haceMin', { n: min });
  const horas = Math.floor(min / 60);
  if (horas < 24) return t('tiempo.haceHoras', { n: horas });
  return t('tiempo.haceDias', { n: Math.floor(horas / 24) });
}

export function capitalizar(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
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

/** "HH:MM" time in Europe/Madrid from an ISO; null if it doesn't parse. */
export function horaLocalMadrid(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha);
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

export function emojiCielo(cielo: string | null): string {
  if (!cielo) return '\u26C5';
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

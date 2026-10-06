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
import type { TextKey } from '../shared/i18n/es';
import { withoutAccents } from '../shared/seo/beachUrls';
import { madridDate, madridMinutes } from '../../../../../Dev/playas-cantabria/frontend/src/shared/format/time';
import { classifySky, hasPrecipitation, skyEmoji } from '../../../../../Dev/playas-cantabria/frontend/src/shared/sky/sky';

// Sky classification lives in shared/cielo/sky.ts; the Spanish names remain
// here as compatibility aliases for the existing call sites.
export { skyEmoji, skyWord } from '../../../../../Dev/playas-cantabria/frontend/src/shared/sky/sky';

/** Normalizes for search: lowercase + no accents (Arn\u00EDa \u2192 arnia). */
export function normalizeSearch(text: string): string {
  // Shares the accent-stripper with the URL module: the previous inline
  // `\p{M}` regex cost ~4 kB of bundle once Babel expanded it (see
  // seo/beachUrls.js).
  return withoutAccents(text.toLowerCase());
}

/**
 * Does the beach match the search term? Searches (ignoring accents) in
 * `nombre`, `municipio` and `alias`, so that a canonical name or an alias (place name,
 * sector or Cruz Roja station name) finds the beach without duplicating results.
 */
export function matchesBeach(
  p: { nombre: string; municipio: string; alias?: string[] },
  term: string
): boolean {
  const t = normalizeSearch(term);
  if (normalizeSearch(p.nombre).includes(t) || normalizeSearch(p.municipio).includes(t)) {
    return true;
  }
  return (p.alias ?? []).some((a) => normalizeSearch(a).includes(t));
}

export function flagColorClass(flag?: string): string {
  const b = flag?.toLowerCase() || '';
  if (b.includes('negra')) return 'black';
  if (b.includes('roja')) return 'red';
  if (b.includes('amarilla')) return 'yellow';
  if (b.includes('verde')) return 'green';
  return 'unknown';
}

export function isFlagAvailable(redCross?: { bandera?: string }): boolean {
  if (!redCross) return false;
  const b = redCross.bandera?.toLowerCase() || '';
  return b.includes('negra') || b.includes('roja') || b.includes('amarilla') || b.includes('verde');
}

export type FlagStatus = 'color' | 'fueraDeHorario' | 'sinDatos';

/** Converts "DD-MM-YYYY" (Cruz Roja format) to "YYYY-MM-DD"; null if it doesn't parse. */
function isoDesdeDDMMYYYY(date?: string | null): string | null {
  if (!date) return null;
  const m = date.match(/(\d{2})-(\d{2})-(\d{4})/);
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
const MAX_FLAG_AGE_MS = 8 * 60 * 60 * 1000; // 8h — mirror of flagVigencia.ts

/**
 * Is the flag capture (ISO) recent (≤8h)?
 * If the ISO doesn't parse, it is assumed fresh (lenient) so as not to hide good data.
 */
export function isRecentInfo(iso: string, now: Date = new Date()): boolean {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return true;
  return now.getTime() - ms <= MAX_FLAG_AGE_MS;
}

/**
 * Are we within the lifeguard hours (and season), in Madrid time?
 * Returns null if there is no schedule data to decide.
 */
export function withinHours(
  redCross?: { horario?: string | null; coberturaDesde?: string | null; coberturaHasta?: string | null },
  now: Date = new Date()
): boolean | null {
  if (!redCross?.horario) return null;
  const m = redCross.horario.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;

  // Out of season (coverage) → no service even if it's mid-afternoon.
  const today = madridDate(now);
  const from = isoDesdeDDMMYYYY(redCross.coberturaDesde);
  const until = isoDesdeDDMMYYYY(redCross.coberturaHasta);
  if (from && today < from) return false;
  if (until && today > until) return false;

  const cur = madridMinutes(now);
  const start = +m[1] * 60 + +m[2];
  const end = +m[3] * 60 + +m[4];
  return cur >= start && cur <= end;
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
export function flagStatus(
  redCross?: { bandera?: string; horario?: string | null; coberturaDesde?: string | null; coberturaHasta?: string | null; ultimaActualizacion?: string | null },
  now: Date = new Date()
): FlagStatus {
  if (withinHours(redCross, now) === false) return 'fueraDeHorario';
  const fresh = redCross?.ultimaActualizacion
    ? isRecentInfo(redCross.ultimaActualizacion, now)
    : true;
  if (isFlagAvailable(redCross) && fresh) return 'color';
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
export function lastRecordedFlag(
  redCross?: {
    bandera?: string;
    horario?: string | null;
    coberturaDesde?: string | null;
    coberturaHasta?: string | null;
    ultimaActualizacion?: string | null;
  },
  now: Date = new Date()
): { bandera: string; registradaIso: string } | null {
  if (!isFlagAvailable(redCross) || withinHours(redCross, now) !== false) return null;

  const capture = redCross?.ultimaActualizacion ? new Date(redCross.ultimaActualizacion) : null;
  if (!capture || Number.isNaN(capture.getTime())) return null;

  const m = redCross!.horario!.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const start = +m[1] * 60 + +m[2];
  const end = +m[3] * 60 + +m[4];

  // Clamp the capture to the closing of the lifeguard day it belongs to.
  const captureMin = madridMinutes(capture);
  let registrada = capture.getTime();
  if (captureMin > end) registrada -= (captureMin - end) * 60000; // closed that same day
  else if (captureMin < start) registrada -= (captureMin + 1440 - end) * 60000; // closed the previous day

  if (now.getTime() - registrada > MAX_FLAG_AGE_MS) return null;

  // A record outside the coverage season does not correspond to real lifeguarding.
  const day = madridDate(new Date(registrada));
  const from = isoDesdeDDMMYYYY(redCross?.coberturaDesde);
  const until = isoDesdeDDMMYYYY(redCross?.coberturaHasta);
  if ((from && day < from) || (until && day > until)) return null;

  return { bandera: redCross!.bandera!, registradaIso: new Date(registrada).toISOString() };
}

/** Does the beach have a showable webcam? (it exists and is not deactivated). */
export function webcamAvailable(
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
export function lifeguardAvailable(
  beach?: {
    fuenteBanderas?: string | null;
    idCruzRoja?: number;
    cruzRojaStations?: Array<{ id?: number }>;
  } | null
): boolean {
  // The explicit operator from current DTOs is authoritative. Consult the
  // Cruz Roja fields only for old backends and the local fallback catalog.
  if (beach?.fuenteBanderas !== undefined) {
    return beach.fuenteBanderas !== null;
  }

  const withStation = (beach?.cruzRojaStations ?? []).some(
    (p) => typeof p.id === 'number' && p.id > 0
  );
  if (withStation) return true;
  return (beach?.idCruzRoja ?? 0) > 0;
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
const LEGACY_OPERATOR = 'Cruz Roja';

export function lifeguardOperator(
  beach?: { fuenteBanderas?: string | null } | null
): string | null {
  if (!beach || beach.fuenteBanderas === undefined) return LEGACY_OPERATOR;
  return beach.fuenteBanderas;
}

export type WebcamCoverage = 'exacta' | 'compartida' | 'cercana';

/**
 * i18n key for a webcam's title/label according to its coverage. The label is
 * the honest signal to the user: a shared or nearby camera is NEVER presented
 * as exact. Returns a `ClaveTexto` to pass to `t()`.
 */
export function webcamCoverageKey(coverage: WebcamCoverage): TextKey {
  switch (coverage) {
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
const wavesIcon =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><path d='M48 192c48-44 112-44 160 0s112 44 160 0 88-38 96-42' fill='none' stroke='currentColor' stroke-width='32' stroke-linecap='round'/><path d='M48 320c48-44 112-44 160 0s112 44 160 0 88-38 96-42' fill='none' stroke='currentColor' stroke-width='32' stroke-linecap='round'/></svg>";

export const ATTR_CONFIG: Record<string, { emoji: string; icon: string; label: string }> = {
  duchas:        { emoji: '\u{1F6BF}', icon: waterOutline, label: 'Duchas' },
  aseos:         { emoji: '\u{1F6BB}', icon: maleFemaleOutline, label: 'Aseos' },
  parking:       { emoji: '\u{1F17F}\uFE0F', icon: carOutline, label: 'Parking' },
  accesible:     { emoji: '\u267F', icon: accessibilityOutline, label: 'Accesible' },
  chiringuito:   { emoji: '\u{1F379}', icon: restaurantOutline, label: 'Chiringuito' },
  surf:          { emoji: '\u{1F3C4}', icon: wavesIcon, label: 'Surf' },
  mascotas:      { emoji: '\u{1F415}', icon: pawOutline, label: 'Mascotas' },
  socorrismo:    { emoji: '\u{1F6DF}', icon: medkitOutline, label: 'Socorrismo' },
  nudista:       { emoji: '\u{1F3D6}\uFE0F', icon: bodyOutline, label: 'Nudista' },
  accesoBanista: { emoji: '\u{1F3CA}', icon: walkOutline, label: 'Acceso ba\u00F1o' },
  submarinismo: { emoji: '\u{1F93F}', icon: fishOutline, label: 'Submarinismo' },
};

/** Returns active attribute entries from a beach's atributos object */
export function getActiveAttrs(attributes?: Record<string, boolean | undefined> | null): Array<{ key: string; emoji: string; icon: string; label: string }> {
  if (!attributes) return [];
  return Object.entries(attributes)
    .filter(([key, val]) => val === true && ATTR_CONFIG[key])
    .map(([key]) => ({ key, ...ATTR_CONFIG[key] }));
}

/**
 * Is there active rain right now? Priority: structured signal from the backend
 * (`lluvia.estado`, multi-source) → observed mm → regex over the sky
 * text (fallback for old backends without the field).
 */
export function isRainActive(
  currentConditions?: {
    cielo?: string | null;
    precipitacionMm?: number | null;
    lluvia?: { estado: string } | null;
  } | null
): boolean {
  if (!currentConditions) return false;
  if (currentConditions.lluvia?.estado === 'lloviendo') return true;
  if (currentConditions.lluvia?.estado === 'sin_lluvia') return false;
  if ((currentConditions.precipitacionMm ?? 0) > 0) return true;
  return hasPrecipitation(classifySky(currentConditions.cielo));
}

/**
 * FORECAST rain to display. Returns null if it is already raining (the active
 * rain badge has priority — never two badges at once) or if there is no signal.
 */
export function expectedRain(
  currentConditions?: {
    cielo?: string | null;
    precipitacionMm?: number | null;
    lluvia?: { estado: string; prevista?: { desdeIso: string | null; mm: number | null; fuentes: string[] } | null } | null;
  } | null
): { desdeIso: string | null; mm: number | null; fuentes: string[] } | null {
  if (!currentConditions) return null;
  if (isRainActive(currentConditions)) return null;
  return currentConditions.lluvia?.prevista ?? null;
}

/**
 * Whether a ranked beach's reading is at NIGHT, per the provider's own icon
 * suffix (`01d` / `01n`). It lives here so every surface asks the same
 * question the same way: the listing, the map and the home card all render a
 * sky and all used to draw a sun at 3 a.m.
 *
 * The detail does not go through here — its observation carries an explicit
 * `esNoche`, because `iconToLegacy` drops the suffix on that path.
 */
export function isNightAt(weather?: { iconoClima?: string | null } | null): boolean {
  return weather?.iconoClima?.endsWith('n') === true;
}

/**
 * Sky emoji for a ranked/featured entry (map marker, home cards, list): the
 * live rain signal wins over the model's sky. OpenWeather's current
 * observation keeps saying "nubes" during drizzle, which is how the map drew
 * clouds while the detail said "lloviendo" — same override the detail applies
 * in ForecastHero, reading the same `lluvia` signal.
 */
export function rankedSkyEmoji(
  weather: {
    descripcionClima: string | null;
    iconoClima?: string | null;
    lluvia?: { estado: string } | null;
  },
): string {
  if (isRainActive({ cielo: weather.descripcionClima, lluvia: weather.lluvia ?? null })) {
    return '\u{1F327}️';
  }
  return skyEmoji(weather.descripcionClima, isNightAt(weather));
}

/**
 * Data provenance model: WHO produced a value, of WHAT nature it is
 * (observation, forecast, static) and WHEN it was produced — normalized once,
 * at the boundary, instead of ad hoc in each component.
 *
 * The API mixes formats: ISO strings (`tiempoActual.timestamp`,
 * `cruzRoja.ultimaActualizacion`), epoch milliseconds (featured `timestamp`)
 * and raw prose (`prediccionCompleta.elaboracion`). Everything here goes
 * through `normalizarInstante`; prose is NEVER parsed into a timestamp.
 *
 * Nothing in this module invents data: every builder returns `null` (or a
 * null field) when the API did not send the value.
 */

import type { BeachDetail } from '../../services/api';
import type { Language } from '../../shared/i18n/IdiomaContext';

/** Nature of a displayed value. Mirrors the plan's live/forecast/static/unavailable. */
export type DataKind = 'directo' | 'prevision' | 'estatico' | 'sinDatos';

export interface Provenance {
  kind: DataKind;
  /** Public name of the producer, exactly as the API credits it. */
  source: string | null;
  /** Instant the value was produced/captured, or null if the API sent none. */
  instantMs: number | null;
}

/**
 * ISO string or epoch milliseconds → epoch milliseconds; null if absent or
 * unparseable. The single place where the API's mixed timestamp formats meet.
 */
export function normalizeInstant(
  input: string | number | null | undefined
): number | null {
  if (input == null || input === '') return null;
  const ms = typeof input === 'number' ? input : new Date(input).getTime();
  return Number.isFinite(ms) && !Number.isNaN(ms) ? ms : null;
}

/**
 * Past this age, what `/details` painted is no longer a reading from now: it is
 * a copy the service worker or the backend's stale cache handed over.
 *
 * Ten minutes is that endpoint's whole window — 60 s fresh plus 600 s stale —
 * so past it the backend cannot be the source. The ranking used to share this
 * number and must not: `/featured` answers from a window six times longer, and
 * the two constants below say so.
 */
export const STALE_DATA_THRESHOLD_MS = 10 * 60 * 1000;

/**
 * Age at which the ranking asks again, on its own and in silence.
 *
 * Ten minutes because `/featured`'s fresh TTL is five: past that the backend
 * already has something newer to give. This is the ONLY thing that refreshes a
 * screen left open and untouched — the phone face-up on the towel — because
 * there is no polling anywhere, so it cannot be folded back into the notice's
 * threshold below however alike the two numbers look today.
 */
export const RANKING_REVALIDATE_AGE_MS = 10 * 60 * 1000;

/**
 * Age past which the painted ranking CANNOT have come from the backend, and is
 * therefore said out loud.
 *
 * `/featured` answers from `getOrSetStale(300 s, 3600 s)`: for up to an hour it
 * legitimately returns the same `generadoEn` while it recomputes behind. Judging
 * it by the `/details` threshold lit the notice on ordinary days, and nothing
 * the user could do would retire it — the backend was going to hand back that
 * same body. Past the stale window it means what it says: this is a copy from
 * the service worker or the snapshot.
 */
export const STALE_RANKING_THRESHOLD_MS = 60 * 60 * 1000;

/**
 * Absolute, human-readable instant in Europe/Madrid — the accessible
 * counterpart of the relative "hace X min" text. Locale follows the UI
 * language; the timezone is always the beaches' own.
 */
export function formatAbsoluteInstant(ms: number, language: Language): string {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date(ms));
}

/**
 * Public name of a weather source. AEMET_XML / AEMET_HTML are transport
 * details of the same producer — the user is always told "AEMET".
 */
export function weatherSourceName(source: string): string {
  return source.replace('AEMET_HTML', 'AEMET').replace('AEMET_XML', 'AEMET');
}

/**
 * How old an observation may be and still be presented as "now".
 *
 * Three hours: enough slack for a Render free instance waking up or a
 * provider down for a while, and short enough that this morning's sky is
 * never shown as the current sky. Past it the value is not aged with a
 * warning — it is WITHDRAWN, because a wrong "it is sunny" is worse than
 * "dato no disponible" on the screen someone uses to decide whether to go.
 */
export const MAX_OBSERVATION_AGE_MS = 3 * 60 * 60 * 1000;

/**
 * Whether an observation is recent enough to be shown as the current state.
 * An observation with NO timestamp cannot be vouched for, so it is not
 * current either.
 */
export function currentObservation(
  currentConditions: BeachDetail['tiempoActual'],
  nowMs: number = Date.now()
): boolean {
  const ms = normalizeInstant(currentConditions?.timestamp);
  if (ms == null) return false;
  return nowMs - ms <= MAX_OBSERVATION_AGE_MS;
}

/**
 * Provenance of the real-time observation block (`tiempoActual`): a live
 * value, credited to its provider, stamped when the backend captured it.
 * Null when there is no observation at all — never a fabricated source.
 */
export function observationProvenance(
  currentConditions: BeachDetail['tiempoActual']
): Provenance | null {
  if (!currentConditions) return null;
  const source = currentConditions.fuente || null;
  const instantMs = normalizeInstant(currentConditions.timestamp);
  if (!source && instantMs == null) return null;
  return { kind: 'directo', source, instantMs };
}

/**
 * Provenance of the hourly outlook. The API credits a producer
 * (`previsionHorasFuente`) but sends no emission time — so none is shown.
 */
export function hourlyForecastProvenance(
  source: string | null | undefined
): Provenance | null {
  if (!source) return null;
  return { kind: 'prevision', source, instantMs: null };
}

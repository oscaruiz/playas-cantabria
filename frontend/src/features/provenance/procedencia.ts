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

import type { PlayaDetalle } from '../../services/api';
import type { Idioma } from '../../shared/i18n/IdiomaContext';

/** Nature of a displayed value. Mirrors the plan's live/forecast/static/unavailable. */
export type TipoDato = 'directo' | 'prevision' | 'estatico' | 'sinDatos';

export interface Procedencia {
  tipo: TipoDato;
  /** Public name of the producer, exactly as the API credits it. */
  fuente: string | null;
  /** Instant the value was produced/captured, or null if the API sent none. */
  instanteMs: number | null;
}

/**
 * ISO string or epoch milliseconds → epoch milliseconds; null if absent or
 * unparseable. The single place where the API's mixed timestamp formats meet.
 */
export function normalizarInstante(
  entrada: string | number | null | undefined
): number | null {
  if (entrada == null || entrada === '') return null;
  const ms = typeof entrada === 'number' ? entrada : new Date(entrada).getTime();
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
export const UMBRAL_DATOS_VIEJOS_MS = 10 * 60 * 1000;

/**
 * Age at which the ranking asks again, on its own and in silence.
 *
 * Ten minutes because `/featured`'s fresh TTL is five: past that the backend
 * already has something newer to give. This is the ONLY thing that refreshes a
 * screen left open and untouched — the phone face-up on the towel — because
 * there is no polling anywhere, so it cannot be folded back into the notice's
 * threshold below however alike the two numbers look today.
 */
export const EDAD_REVALIDAR_RANKING_MS = 10 * 60 * 1000;

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
export const UMBRAL_RANKING_VIEJO_MS = 60 * 60 * 1000;

/**
 * Absolute, human-readable instant in Europe/Madrid — the accessible
 * counterpart of the relative "hace X min" text. Locale follows the UI
 * language; the timezone is always the beaches' own.
 */
export function formatearInstanteAbsoluto(ms: number, idioma: Idioma): string {
  return new Intl.DateTimeFormat(idioma === 'en' ? 'en-GB' : 'es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date(ms));
}

/**
 * Public name of a weather source. AEMET_XML / AEMET_HTML are transport
 * details of the same producer — the user is always told "AEMET".
 */
export function nombreFuenteMeteo(fuente: string): string {
  return fuente.replace('AEMET_HTML', 'AEMET').replace('AEMET_XML', 'AEMET');
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
export const MAX_EDAD_OBSERVACION_MS = 3 * 60 * 60 * 1000;

/**
 * Whether an observation is recent enough to be shown as the current state.
 * An observation with NO timestamp cannot be vouched for, so it is not
 * current either.
 */
export function observacionVigente(
  tiempoActual: PlayaDetalle['tiempoActual'],
  ahoraMs: number = Date.now()
): boolean {
  const ms = normalizarInstante(tiempoActual?.timestamp);
  if (ms == null) return false;
  return ahoraMs - ms <= MAX_EDAD_OBSERVACION_MS;
}

/**
 * Provenance of the real-time observation block (`tiempoActual`): a live
 * value, credited to its provider, stamped when the backend captured it.
 * Null when there is no observation at all — never a fabricated source.
 */
export function procedenciaObservacion(
  tiempoActual: PlayaDetalle['tiempoActual']
): Procedencia | null {
  if (!tiempoActual) return null;
  const fuente = tiempoActual.fuente || null;
  const instanteMs = normalizarInstante(tiempoActual.timestamp);
  if (!fuente && instanteMs == null) return null;
  return { tipo: 'directo', fuente, instanteMs };
}

/**
 * Provenance of the hourly outlook. The API credits a producer
 * (`previsionHorasFuente`) but sends no emission time — so none is shown.
 */
export function procedenciaPrevisionHoras(
  fuente: string | null | undefined
): Procedencia | null {
  if (!fuente) return null;
  return { tipo: 'prevision', fuente, instanteMs: null };
}

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

/**
 * Attribution of every external source the app shows: the name it must be
 * credited by, the link its terms require, and the notice its licence demands
 * next to the data.
 *
 * It is ONE table because attribution is a legal obligation, not decoration: a
 * source that reaches the API without an entry here would be shown uncredited.
 * `atribucionDeFuente` normalizes whatever the API sends (`AEMET_HTML`,
 * `AEMET_XML`, `Open-Meteo`, `OpenMeteo`…) instead of trusting each call site
 * to spell it the same way, and returns null for anything unknown — an
 * invented credit would be worse than none.
 */

import type { ClaveTexto } from '../../shared/i18n/es';

export interface Atribucion {
  /** Public name of the producer, exactly as it must be credited. */
  nombre: string;
  /** The producer's own page: the link the terms require. */
  url: string;
  /**
   * Notice the licence requires next to the data, as an i18n key with a
   * `{fuente}` slot where the linked name goes. Null when crediting the name
   * with its link is all the source asks for.
   */
  nota: ClaveTexto | null;
}

const ATRIBUCIONES: Record<string, Atribucion> = {
  AEMET: {
    nombre: 'AEMET',
    url: 'https://www.aemet.es',
    nota: 'atribucion.aemet',
  },
  // Free plan (`api.openweathermap.org/data/2.5/weather` and `/forecast`):
  // the data is CC BY-SA 4.0, so the credit must name OpenWeather and link to it.
  OPENWEATHER: {
    nombre: 'OpenWeather',
    url: 'https://openweathermap.org',
    nota: 'atribucion.openweather',
  },
  OPENMETEO: {
    nombre: 'Open-Meteo',
    url: 'https://open-meteo.com',
    nota: 'atribucion.openmeteo',
  },
  // The public beach list of the same console the backend reads. The console's
  // root (`/appjv/consPlayas`) 404s when opened directly, so the credit points
  // at `listaPlayas.do`: a dead link credits nobody.
  CRUZROJA: {
    nombre: 'Cruz Roja',
    url: 'https://www.cruzroja.es/appjv/consPlayas/listaPlayas.do',
    nota: 'atribucion.banderas',
  },
  OPENSTREETMAP: {
    nombre: 'OpenStreetMap',
    url: 'https://www.openstreetmap.org/copyright',
    nota: null,
  },
};

/**
 * `AEMET_HTML`, `Open-Meteo`, `Cruz Roja` → the table's key. AEMET_XML and
 * AEMET_HTML are transports of the same producer: the user is always told
 * AEMET, and AEMET is who has to be credited.
 */
function normalizar(fuente: string): string {
  const limpio = fuente.trim().toUpperCase().replace(/[^A-Z]/g, '');
  return limpio.startsWith('AEMET') ? 'AEMET' : limpio;
}

/** Attribution owed to a source, or null if we do not know that source. */
export function atribucionDeFuente(
  fuente: string | null | undefined
): Atribucion | null {
  if (!fuente) return null;
  return ATRIBUCIONES[normalizar(fuente)] ?? null;
}

/** The name a source must be credited by; the raw string if it is unknown. */
export function nombrePublicoFuente(fuente: string): string {
  return atribucionDeFuente(fuente)?.nombre ?? fuente;
}

/**
 * Whether two source names belong to the same producer (`AEMET_HTML` and
 * `AEMET` do). Used to avoid crediting the same source twice in a row when
 * the observation and the forecast happen to come from it.
 */
export function mismaFuente(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false;
  return normalizar(a) === normalizar(b);
}

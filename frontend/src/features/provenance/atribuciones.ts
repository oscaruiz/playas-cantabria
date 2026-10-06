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

import type { TextKey } from '../../shared/i18n/es';

export interface Attribution {
  /** Public name of the producer, exactly as it must be credited. */
  name: string;
  /** The producer's own page: the link the terms require. */
  url: string;
  /**
   * Notice the licence requires next to the data, as an i18n key with a
   * `{fuente}` slot where the linked name goes. Null when crediting the name
   * with its link is all the source asks for.
   */
  note: TextKey | null;
}

const ATTRIBUTIONS: Record<string, Attribution> = {
  AEMET: {
    name: 'AEMET',
    url: 'https://www.aemet.es',
    note: 'atribucion.aemet',
  },
  // Free plan (`api.openweathermap.org/data/2.5/weather` and `/forecast`):
  // the data is CC BY-SA 4.0, so the credit must name OpenWeather and link to it.
  OPENWEATHER: {
    name: 'OpenWeather',
    url: 'https://openweathermap.org',
    note: 'atribucion.openweather',
  },
  OPENMETEO: {
    name: 'Open-Meteo',
    url: 'https://open-meteo.com',
    note: 'atribucion.openmeteo',
  },
  // The public beach list of the same console the backend reads. The console's
  // root (`/appjv/consPlayas`) 404s when opened directly, so the credit points
  // at `listaPlayas.do`: a dead link credits nobody.
  CRUZROJA: {
    name: 'Cruz Roja',
    url: 'https://www.cruzroja.es/appjv/consPlayas/listaPlayas.do',
    note: 'atribucion.banderas',
  },
  OPENSTREETMAP: {
    name: 'OpenStreetMap',
    url: 'https://www.openstreetmap.org/copyright',
    note: null,
  },
};

/**
 * `AEMET_HTML`, `Open-Meteo`, `Cruz Roja` → the table's key. AEMET_XML and
 * AEMET_HTML are transports of the same producer: the user is always told
 * AEMET, and AEMET is who has to be credited.
 */
function normalize(source: string): string {
  const clean = source.trim().toUpperCase().replace(/[^A-Z]/g, '');
  return clean.startsWith('AEMET') ? 'AEMET' : clean;
}

/** Attribution owed to a source, or null if we do not know that source. */
export function sourceAttribution(
  source: string | null | undefined
): Attribution | null {
  if (!source) return null;
  return ATTRIBUTIONS[normalize(source)] ?? null;
}

/** The name a source must be credited by; the raw string if it is unknown. */
export function publicSourceName(source: string): string {
  return sourceAttribution(source)?.name ?? source;
}

/**
 * Whether two source names belong to the same producer (`AEMET_HTML` and
 * `AEMET` do). Used to avoid crediting the same source twice in a row when
 * the observation and the forecast happen to come from it.
 */
export function sameSource(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a || !b) return false;
  return normalize(a) === normalize(b);
}

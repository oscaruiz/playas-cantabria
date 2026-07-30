import type { RainNowcast } from '../entities/RainNowcast';
import type { DayForecast } from '../entities/BeachForecast';

/**
 * Combined "it is going to rain" signal (FORECAST rain, not active):
 *   - Open-Meteo: minutely_15 slots for the next ~6h (numeric, gives a time).
 *   - AEMET text: sky description for the remaining part of TODAY
 *     ("Chubascos", "Intervalos nubosos con lluvia", ...).
 * Either one triggers it. It is a pure helper WITHOUT cache: the AEMET text
 * varies by flow (featured uses the day's summary; detail uses the scraper's
 * half-days) and cannot go into GetRainNowcast's by-coordinates cache.
 */

export const LLUVIA_TEXTO_RE = /lluvia|llovizna|chubasc|tormenta/i;

export function hayLluviaEnTexto(texto: string | null | undefined): boolean {
  return !!texto && LLUVIA_TEXTO_RE.test(texto);
}

export interface RainForecastSignal {
  expected: boolean;
  /** Epoch ms of the first slot with precipitation; null if the signal is text-only (AEMET). */
  firstAt: number | null;
  /** Maximum forecast mm per slot (Open-Meteo only). */
  mmMax: number | null;
  /** Only the sources that TRIGGERED the signal. */
  sources: Array<'OpenMeteo' | 'AEMET'>;
}

/**
 * Combines the nowcast's numeric forecast (rain.upcoming) with the AEMET
 * forecast texts. Returns null if there is no signal at all to evaluate
 * (Open-Meteo without slots AND no text available).
 */
export function buildRainForecastSignal(
  rain: RainNowcast | null | undefined,
  aemetTexts: Array<string | null | undefined>,
): RainForecastSignal | null {
  const upcoming = rain?.upcoming ?? null;
  const textsAvailable = aemetTexts.some((t) => !!t);
  if (!upcoming && !textsAvailable) return null;

  const omExpected = upcoming?.expected === true;
  const textExpected = aemetTexts.some(hayLluviaEnTexto);

  const sources: RainForecastSignal['sources'] = [];
  if (omExpected) sources.push('OpenMeteo');
  if (textExpected) sources.push('AEMET');

  return {
    expected: omExpected || textExpected,
    firstAt: omExpected ? upcoming!.firstAt : null,
    mmMax: omExpected ? upcoming!.mmMax : null,
    sources,
  };
}

/** Current hour (0-23) in Europe/Madrid, robust to the server's TZ. */
export function horaMadrid(ahora: Date = new Date()): number {
  const hh = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    hour12: false,
  }).format(ahora);
  return Number(hh) % 24; // Intl may return "24" for midnight
}

/**
 * Sky texts for the REMAINING part of today: before 14h (Madrid) both
 * morning and afternoon count; from 14h on, only the afternoon. That way a
 * morning rain that has already passed does not penalize a clear afternoon.
 */
export function textosRestantesHoy(
  day: DayForecast | null | undefined,
  ahora: Date = new Date(),
): string[] {
  if (!day) return [];
  const textos: string[] = [];
  if (horaMadrid(ahora) < 14 && day.morning.skyDescription) {
    textos.push(day.morning.skyDescription);
  }
  if (day.afternoon.skyDescription) {
    textos.push(day.afternoon.skyDescription);
  }
  return textos;
}

import type { RainNowcast } from '../entities/RainNowcast';
import type { DayForecast } from '../entities/BeachForecast';

/**
 * Señal combinada de "va a llover" (lluvia PREVISTA, no activa):
 *   - Open-Meteo: tramos minutely_15 de las próximas ~6h (numérico, da hora).
 *   - Texto AEMET: descripción del cielo del tramo restante de HOY
 *     ("Chubascos", "Intervalos nubosos con lluvia", ...).
 * Cualquiera de las dos dispara. Es un helper puro SIN caché: el texto AEMET
 * varía según el flujo (featured usa el summary del día; detalle usa los
 * medios-días del scraper) y no puede entrar en la caché por coordenadas
 * de GetRainNowcast.
 */

export const LLUVIA_TEXTO_RE = /lluvia|llovizna|chubasc|tormenta/i;

export function hayLluviaEnTexto(texto: string | null | undefined): boolean {
  return !!texto && LLUVIA_TEXTO_RE.test(texto);
}

export interface RainForecastSignal {
  expected: boolean;
  /** Epoch ms del primer tramo con precipitación; null si la señal es solo textual (AEMET). */
  firstAt: number | null;
  /** Máximo mm por tramo previsto (solo Open-Meteo). */
  mmMax: number | null;
  /** Solo las fuentes que DISPARARON la señal. */
  sources: Array<'OpenMeteo' | 'AEMET'>;
}

/**
 * Combina la previsión numérica del nowcast (rain.upcoming) con los textos
 * de previsión AEMET. Devuelve null si no hay señal alguna que evaluar
 * (Open-Meteo sin tramos Y ningún texto disponible).
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

/** Hora (0-23) actual en Europe/Madrid, robusta a la TZ del servidor. */
export function horaMadrid(ahora: Date = new Date()): number {
  const hh = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    hour12: false,
  }).format(ahora);
  return Number(hh) % 24; // Intl puede devolver "24" para medianoche
}

/**
 * Textos de cielo de la parte RESTANTE de hoy: antes de las 14h (Madrid)
 * cuentan mañana y tarde; a partir de las 14h, solo la tarde. Así una lluvia
 * matinal ya pasada no penaliza una tarde despejada.
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

import { TraducirFn, Idioma } from '../../shared/i18n/IdiomaContext';
import { capitalizar } from '../../shared/format/texto';
import { nombreDia, traducirNombreDiaApi, formatearFechaCorta } from '../../shared/i18n/fechas';

/**
 * Extract day-of-month from fecha string.
 * Handles both "domingo 05" (AEMET HTML scraper) and "2026-04-06" (ISO) formats.
 */
export function parseDayOfMonth(fecha: string): number {
  if (!fecha) return -1;
  // ISO format: "2026-04-06"
  if (/^\d{4}-\d{2}-\d{2}/.test(fecha)) {
    return new Date(fecha + 'T12:00:00').getDate();
  }
  // AEMET format: "domingo 05"
  const match = fecha.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : -1;
}

export function dayTitle(fecha: string, t: TraducirFn, idioma: Idioma): string {
  const dayNum = parseDayOfMonth(fecha);
  if (dayNum < 0) return fecha || '?';

  const now = new Date();
  const hoy = now.getDate();
  const manana = new Date(now);
  manana.setDate(hoy + 1);
  const pasado = new Date(now);
  pasado.setDate(hoy + 2);

  if (dayNum === hoy) return t('fecha.hoy');
  if (dayNum === manana.getDate()) return t('fecha.manana');
  if (dayNum === pasado.getDate()) return t('fecha.pasadoManana');

  // Date out of range — extract the day name from the string (Spanish, from the API)
  const nombreDiaApi = fecha.split(/\s/)[0];
  const traducido = traducirNombreDiaApi(nombreDiaApi, idioma);
  return capitalizar(traducido ?? nombreDiaApi) || fecha;
}

/**
 * Month of a forecast day that AEMET labels with its day of month only
 * ("sábado 01"). A day number below today's has rolled over into the next
 * month: the forecast never reaches beyond 3 days, so that is unambiguous.
 * Using the current month printed "1 de julio" for August 1st on the last days
 * of every month. Date arithmetic rolls the year over on its own (31-dic → ene).
 */
export function forecastMonth(dayNum: number, now: Date): number {
  const month = dayNum < now.getDate() ? now.getMonth() + 1 : now.getMonth();
  return new Date(now.getFullYear(), month, dayNum, 12).getMonth();
}

export function daySubtitle(fecha: string, idioma: Idioma): string {
  const dayNum = parseDayOfMonth(fecha);
  if (dayNum < 0) return '';

  // AEMET format like "domingo 05" — name from the string + day + resolved month
  const nombreDiaApi = fecha.split(/\s/)[0];
  if (nombreDiaApi && /^[a-z\u00e1-\u00fa]/i.test(nombreDiaApi)) {
    const traducido = traducirNombreDiaApi(nombreDiaApi, idioma) ?? nombreDiaApi;
    return formatearFechaCorta(capitalizar(traducido), dayNum, forecastMonth(dayNum, new Date()), idioma);
  }

  // ISO fallback
  const d = new Date(fecha + 'T12:00:00');
  return formatearFechaCorta(capitalizar(nombreDia(d.getDay(), idioma)), d.getDate(), d.getMonth(), idioma);
}

export function isToday(fecha: string): boolean {
  return parseDayOfMonth(fecha) === new Date().getDate();
}

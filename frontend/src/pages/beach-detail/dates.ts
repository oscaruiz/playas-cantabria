import { TranslateFn, Language } from '../../shared/i18n/LanguageContext';
import { capitalize } from '../../shared/format/text';
import { dayName, translateApiDayName, formatShortDate } from '../../shared/i18n/dates';

/**
 * Extract day-of-month from fecha string.
 * Handles both "domingo 05" (AEMET HTML scraper) and "2026-04-06" (ISO) formats.
 */
export function parseDayOfMonth(date: string): number {
  if (!date) return -1;
  // ISO format: "2026-04-06"
  if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
    return new Date(date + 'T12:00:00').getDate();
  }
  // AEMET format: "domingo 05"
  const match = date.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : -1;
}

export function dayTitle(date: string, t: TranslateFn, language: Language): string {
  const dayNum = parseDayOfMonth(date);
  if (dayNum < 0) return date || '?';

  const now = new Date();
  const today = now.getDate();
  const morning = new Date(now);
  morning.setDate(today + 1);
  const past = new Date(now);
  past.setDate(today + 2);

  if (dayNum === today) return t('fecha.hoy');
  if (dayNum === morning.getDate()) return t('fecha.manana');
  if (dayNum === past.getDate()) return t('fecha.pasadoManana');

  // Date out of range — extract the day name from the string (Spanish, from the API)
  const apiDayName = date.split(/\s/)[0];
  const translated = translateApiDayName(apiDayName, language);
  return capitalize(translated ?? apiDayName) || date;
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

export function daySubtitle(date: string, language: Language): string {
  const dayNum = parseDayOfMonth(date);
  if (dayNum < 0) return '';

  // AEMET format like "domingo 05" — name from the string + day + resolved month
  const apiDayName = date.split(/\s/)[0];
  if (apiDayName && /^[a-z\u00e1-\u00fa]/i.test(apiDayName)) {
    const translated = translateApiDayName(apiDayName, language) ?? apiDayName;
    return formatShortDate(capitalize(translated), dayNum, forecastMonth(dayNum, new Date()), language);
  }

  // ISO fallback
  const d = new Date(date + 'T12:00:00');
  return formatShortDate(capitalize(dayName(d.getDay(), language)), d.getDate(), d.getMonth(), language);
}

export function isToday(date: string): boolean {
  return parseDayOfMonth(date) === new Date().getDate();
}

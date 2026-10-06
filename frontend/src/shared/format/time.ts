/**
 * Time formatting in the beaches' own timezone. Europe/Madrid is not a user
 * preference here: the flags, the schedules and the tides all happen there,
 * whatever timezone the device is set to.
 */

import type { TranslateFn } from '../../../../../../Dev/playas-cantabria/frontend/src/shared/i18n/LanguageContext';

/** Minutes elapsed in the day in Madrid time (robust to the device's TZ). */
export function madridMinutes(date: Date): number {
  const hhmm = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** "YYYY-MM-DD" date in Madrid, to compare against the season coverage. */
export function madridDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date); // en-CA → "YYYY-MM-DD"
}

/** "HH:MM" time in Europe/Madrid from an ISO; null if it doesn't parse. */
export function madridLocalHour(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/**
 * "updated X ago" (min / hours / days) from an ISO or epoch ms.
 * Returns '' if it doesn't parse. Reuses the `tiempo.*` i18n keys.
 */
export function formatTimeAgo(input: string | number, t: TranslateFn): string {
  const ms = typeof input === 'number' ? input : new Date(input).getTime();
  if (!ms || Number.isNaN(ms)) return '';
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return t('tiempo.ahoraMismo');
  if (min < 60) return t('tiempo.haceMin', { n: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return t('tiempo.haceHoras', { n: hours });
  return t('tiempo.haceDias', { n: Math.floor(hours / 24) });
}

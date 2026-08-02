/**
 * Time formatting in the beaches' own timezone. Europe/Madrid is not a user
 * preference here: the flags, the schedules and the tides all happen there,
 * whatever timezone the device is set to.
 */

import type { TraducirFn } from '../i18n/IdiomaContext';

/** Minutes elapsed in the day in Madrid time (robust to the device's TZ). */
export function minutosMadrid(fecha: Date): number {
  const hhmm = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha);
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** "YYYY-MM-DD" date in Madrid, to compare against the season coverage. */
export function fechaMadrid(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha); // en-CA → "YYYY-MM-DD"
}

/** "HH:MM" time in Europe/Madrid from an ISO; null if it doesn't parse. */
export function horaLocalMadrid(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha);
}

/**
 * "updated X ago" (min / hours / days) from an ISO or epoch ms.
 * Returns '' if it doesn't parse. Reuses the `tiempo.*` i18n keys.
 */
export function formatearHaceTiempo(input: string | number, t: TraducirFn): string {
  const ms = typeof input === 'number' ? input : new Date(input).getTime();
  if (!ms || Number.isNaN(ms)) return '';
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return t('tiempo.ahoraMismo');
  if (min < 60) return t('tiempo.haceMin', { n: min });
  const horas = Math.floor(min / 60);
  if (horas < 24) return t('tiempo.haceHoras', { n: horas });
  return t('tiempo.haceDias', { n: Math.floor(horas / 24) });
}

/**
 * Ayudas de tiempo para los tests de caracterización.
 *
 * El detalle de playa mezcla dos relojes: las reglas de bandera van siempre en
 * `Europe/Madrid` vía `Intl` (independientes de la TZ del runner), mientras que
 * `dayTitle`, `isToday` y `getTideStatus` usan la hora LOCAL del dispositivo.
 * Como CI corre en UTC y las máquinas de desarrollo en Madrid, cualquier test
 * que dependa de la hora local tiene que fijarla explícitamente en lugar de
 * confiar en un instante UTC concreto.
 */

/**
 * Instante que corresponde a las 12:00 LOCALES del día indicado.
 *
 * Fijar el mediodía local (y no un instante UTC) es lo que hace deterministas
 * los tests de mareas: `getTideStatus` compara contra `getHours()`, así que con
 * mediodía local siempre hay margen de sobra a ambos lados del día para colocar
 * una marea anterior y otra posterior.
 */
export function localNoon(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

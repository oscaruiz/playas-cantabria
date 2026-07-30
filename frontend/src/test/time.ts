/**
 * Time helpers for the characterization tests.
 *
 * The beach detail mixes two clocks: the flag rules always run in
 * `Europe/Madrid` via `Intl` (independent of the runner's TZ), whereas
 * `dayTitle`, `isToday` and `getTideStatus` use the device's LOCAL time.
 * Since CI runs in UTC and development machines in Madrid, any test
 * that depends on local time has to pin it explicitly instead of
 * relying on a specific UTC instant.
 */

/**
 * Instant corresponding to 12:00 LOCAL time on the given day.
 *
 * Pinning local noon (and not a UTC instant) is what makes the tide tests
 * deterministic: `getTideStatus` compares against `getHours()`, so with
 * local noon there is always plenty of margin on both sides of the day to place
 * a previous tide and a later one.
 */
export function localNoon(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

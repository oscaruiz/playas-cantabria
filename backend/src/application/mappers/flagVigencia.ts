import { FlagStatus } from '../../domain/entities/Flag';

/**
 * Validity of the Cruz Roja flag: should the color be shown NOW?
 *
 * A flag is only real while there is surveillance (daily schedule within the
 * coverage season) and if the data is recent. The primary source in prod
 * (`regions/<id>/flags.json`) is refreshed by cron a few times a day and not at all
 * overnight, so the last capture from the past ~24h is accepted; beyond that,
 * the color no longer reflects what is flying and must not be painted.
 *
 * MIRROR of the frontend: the same rule lives in
 * `frontend/src/utils/beachHelpers.ts` (`dentroDeHorario` + `esInfoReciente`,
 * used by `estadoBandera`). Keep both sides in sync.
 */

/** Freshness window: a capture older than this is no longer shown. */
const MAX_EDAD_BANDERA_MS = 24 * 60 * 60 * 1000; // 24h

/** "YYYY-MM-DD" date in Europe/Madrid (robust to the server's TZ). */
function fechaMadrid(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha); // en-CA → "YYYY-MM-DD"
}

/** Minutes elapsed in the day at the current Madrid time. */
function minutosMadrid(fecha: Date): number {
  const hhmm = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha);
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Converts "DD-MM-YYYY" (Cruz Roja format) to "YYYY-MM-DD"; null if it does not parse. */
function isoDesdeDDMMYYYY(fecha?: string | null): string | null {
  if (!fecha) return null;
  const m = fecha.match(/(\d{2})-(\d{2})-(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Are we within the surveillance schedule (and season), in Madrid time?
 * Returns null if there is no schedule to decide with (then it does not block).
 */
function dentroDeHorario(flag: FlagStatus, ahora: Date): boolean | null {
  if (!flag.schedule) return null;
  const m = flag.schedule.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;

  // Out of season → no service even if it is mid-afternoon.
  const hoy = fechaMadrid(ahora);
  const desde = isoDesdeDDMMYYYY(flag.coverageFrom);
  const hasta = isoDesdeDDMMYYYY(flag.coverageTo);
  if (desde && hoy < desde) return false;
  if (hasta && hoy > hasta) return false;

  const cur = minutosMadrid(ahora);
  const ini = +m[1] * 60 + +m[2];
  const fin = +m[3] * 60 + +m[4];
  return cur >= ini && cur <= fin;
}

/** Is the flag capture recent (≤24h)? No valid timestamp → assumed fresh. */
function esInfoReciente(timestamp: number, ahora: Date): boolean {
  if (!timestamp || Number.isNaN(timestamp)) return true;
  return ahora.getTime() - timestamp <= MAX_EDAD_BANDERA_MS;
}

/**
 * Should the flag color be shown NOW? (it does not check that a color exists;
 * the caller decides that). True if we are within schedule/season — or the
 * schedule is unknown — and the data is recent (≤24h).
 */
export function esBanderaVigente(flag: FlagStatus, ahora: Date = new Date()): boolean {
  if (dentroDeHorario(flag, ahora) === false) return false;
  return esInfoReciente(flag.timestamp, ahora);
}

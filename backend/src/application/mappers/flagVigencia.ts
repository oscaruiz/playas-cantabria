import { FlagStatus } from '../../domain/entities/Flag';

/**
 * Vigencia de la bandera de Cruz Roja: ¿debe mostrarse el color AHORA?
 *
 * Una bandera solo es real mientras hay vigilancia (horario diario dentro de la
 * temporada de cobertura) y si el dato es reciente. La fuente primaria en prod
 * (`data/flags.json`) se refresca por cron unas pocas veces al día y nada de
 * madrugada, así que se acepta la última captura de las últimas ~24h; más allá,
 * el color ya no refleja lo que ondea y no debe pintarse.
 *
 * ESPEJO del frontend: la misma regla vive en
 * `frontend/src/utils/beachHelpers.ts` (`dentroDeHorario` + `esInfoReciente`,
 * usados por `estadoBandera`). Mantener ambos lados en sincronía.
 */

/** Ventana de frescura: una captura de hace más de esto ya no se muestra. */
const MAX_EDAD_BANDERA_MS = 24 * 60 * 60 * 1000; // 24h

/** Fecha "YYYY-MM-DD" en Europe/Madrid (robusto a la TZ del servidor). */
function fechaMadrid(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha); // en-CA → "YYYY-MM-DD"
}

/** Minutos transcurridos del día en la hora actual de Madrid. */
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

/** Convierte "DD-MM-YYYY" (formato Cruz Roja) a "YYYY-MM-DD"; null si no parsea. */
function isoDesdeDDMMYYYY(fecha?: string | null): string | null {
  if (!fecha) return null;
  const m = fecha.match(/(\d{2})-(\d{2})-(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * ¿Estamos dentro del horario (y temporada) de vigilancia, en hora de Madrid?
 * Devuelve null si no hay horario para decidir (entonces no bloquea).
 */
function dentroDeHorario(flag: FlagStatus, ahora: Date): boolean | null {
  if (!flag.schedule) return null;
  const m = flag.schedule.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;

  // Fuera de temporada → no hay servicio aunque sea media tarde.
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

/** ¿La captura del flag es reciente (≤24h)? Sin timestamp válido → se asume fresca. */
function esInfoReciente(timestamp: number, ahora: Date): boolean {
  if (!timestamp || Number.isNaN(timestamp)) return true;
  return ahora.getTime() - timestamp <= MAX_EDAD_BANDERA_MS;
}

/**
 * ¿Debe mostrarse el color de la bandera AHORA? (no comprueba que exista color;
 * eso lo decide quien llama). True si estamos dentro de horario/temporada — o no
 * se conoce el horario — y el dato es reciente (≤24h).
 */
export function esBanderaVigente(flag: FlagStatus, ahora: Date = new Date()): boolean {
  if (dentroDeHorario(flag, ahora) === false) return false;
  return esInfoReciente(flag.timestamp, ahora);
}

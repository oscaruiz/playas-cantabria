import type { Weather } from '../entities/Weather';
import type { HourlyOutlookSlot } from '../entities/RainNowcast';
import type { RainForecastSignal } from './RainForecast';
import {
  OUTLOOK_MAX_DELTA,
  computeSkyScore,
  computeTemperatureScore,
  computeWindScore,
  skyScoreFromCloudCover,
} from './BeachScorer';

/**
 * Is the beach about to get better or worse? A bounded correction to the score
 * from the NEXT FEW HOURS.
 *
 * The score was built entirely out of the present, and on this coast the
 * present is a bad summary of the afternoon: Tagle scored 57 at 10:55 with
 * 10/25 of sky for the morning cloud that opens at midday, and the app neither
 * said so nor ranked it accordingly. The reverse costs more: a beach that is
 * sunny at 12:00 and gets cloud and wind at 15:00 was published as the best
 * option of the day.
 *
 * Deliberately NOT a re-weighting of the sub-scores: those describe now, which
 * is what the beach page shows, and mixing tenses inside them would make the
 * ranking reasons contradict the page. This is a separate, bounded delta.
 *
 * Rain is NOT considered here: `RainForecast` already governs it through the
 * two score caps, and counting it twice would penalise a shower once for being
 * forecast and again for the cloud that comes with it.
 */

/** How far ahead we look. */
const VENTANA_MINUTOS = 4 * 60;

/** Beach window in Madrid, in minutes of the day (mirror of `franjaYTemporada`). */
const INICIO_FRANJA_MADRID = 11 * 60;
const FIN_FRANJA_MADRID = 21 * 60;

/**
 * How much of each factor's real change we are willing to anticipate. The
 * delta is not a fourth scale of its own: it is a SHARE of the points that
 * factor would gain or lose, which is why "half the change in sky" can be read
 * off the number directly.
 *
 * Sky first: it is the widest factor in the score (25 of 100) and the most
 * volatile on this coast. Wind last: it almost always rises through the
 * afternoon, so weighting it more would turn every late morning into a
 * downgrade.
 */
const PESOS = { cielo: 0.5, temperatura: 0.3, viento: 0.2 } as const;

/** Below this the change is noise and produces no user-facing text. */
export const OUTLOOK_UMBRAL_TEXTO = 3;

/**
 * WHY the conditions are moving: the dominant factor, phrased as the change
 * itself rather than as its effect on the score.
 *
 * "Mejora" on its own was not actionable — the whole point of looking four
 * hours ahead is that the sky is going to open or the wind is going to get up,
 * and that is what decides whether to go. `lluvia_prevista` is the exception:
 * it does not move the delta (see `resolvePublishedOutlook`), it is the one
 * that most changes the plan.
 */
export type OutlookCausa =
  | 'despeja'
  | 'nubla'
  | 'sube_temperatura'
  | 'baja_temperatura'
  | 'amaina_viento'
  | 'arrecia_viento'
  | 'lluvia_prevista';

export interface OutlookSignal {
  /** Integer in [-OUTLOOK_MAX_DELTA, +OUTLOOK_MAX_DELTA], already rounded. */
  delta: number;
  direccion: 'mejora' | 'empeora' | 'estable';
  /** Slots actually used. 0 never reaches the caller: it returns null instead. */
  horasConsideradas: number;
  /**
   * Dominant factor behind the delta. `null` when the delta is 0: a change too
   * small to score is also too small to name.
   */
  causa: OutlookCausa | null;
}

/** One factor's weighted contribution, kept so the dominant one can be named. */
interface Contribucion {
  /** Points of the score this factor moves, already weighted by `PESOS`. */
  aporte: number;
  /** How to word it. Read from the factor's OWN change, not from `aporte`. */
  causa: OutlookCausa;
}

function media(valores: number[]): number {
  return valores.reduce((sum, v) => sum + v, 0) / valores.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Minutes elapsed in the day, Madrid time (robust to the server's TZ). */
function minutosMadrid(fecha: Date): number {
  const hhmm = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(fecha);
  const [h, m] = hhmm.split(':').map(Number);
  return (h % 24) * 60 + m;
}

/**
 * The next four hours INTERSECTED with the beach window (11:00–21:00 Madrid).
 *
 * At 19:30 what matters is the hour and a half that is left, not a dawn nobody
 * is asking about; at 09:00 the useful part is 11:00 onwards, which is exactly
 * what someone deciding the day wants to know. At 23:00 the intersection is
 * empty and the score is left alone.
 */
export function ventanaOutlook(
  slots: readonly HourlyOutlookSlot[],
  ahora: Date,
): HourlyOutlookSlot[] {
  const minutosAhora = minutosMadrid(ahora);
  const desdeMin = Math.max(minutosAhora, INICIO_FRANJA_MADRID);
  const hastaMin = Math.min(minutosAhora + VENTANA_MINUTOS, FIN_FRANJA_MADRID);
  if (hastaMin <= desdeMin) return [];

  // Back to absolute instants through the offset from now: no date arithmetic,
  // so it cannot slip a day at either end.
  const desde = ahora.getTime() + (desdeMin - minutosAhora) * 60_000;
  const hasta = ahora.getTime() + (hastaMin - minutosAhora) * 60_000;
  return slots.filter((s) => s.timestamp > desde && s.timestamp <= hasta);
}

/**
 * Builds the adjustment. Returns null when there is nothing to compare with —
 * no observation, no slots, out of the beach window, or an Open-Meteo answer
 * with no usable variable — and then the score is exactly what it is today.
 */
export function buildWeatherOutlook(
  weather: Weather | null | undefined,
  slots: readonly HourlyOutlookSlot[] | null | undefined,
  ahora: Date = new Date(),
): OutlookSignal | null {
  if (!weather || !slots || slots.length === 0) return null;

  const ventana = ventanaOutlook(slots, ahora);
  if (ventana.length === 0) return null;

  // Each factor is scored with the SAME function used for the present, so
  // "now" and "later" live on one scale and their difference is in points of
  // the score itself — not in units invented here.
  const cambios: Contribucion[] = [];

  const nubes = ventana
    .map((s) => s.cloudCoverPct)
    .filter((v): v is number => typeof v === 'number');
  if (nubes.length > 0) {
    const ahoraCielo = computeSkyScore(weather);
    const futuro = media(nubes.map(skyScoreFromCloudCover));
    cambios.push({
      aporte: PESOS.cielo * (futuro - ahoraCielo),
      causa: futuro > ahoraCielo ? 'despeja' : 'nubla',
    });
  }

  const temperaturas = ventana
    .map((s) => s.temperatureC)
    .filter((v): v is number => typeof v === 'number');
  if (temperaturas.length > 0 && weather.temperatureC != null) {
    const futuro = media(temperaturas.map(computeTemperatureScore));
    cambios.push({
      aporte: PESOS.temperatura * (futuro - computeTemperatureScore(weather.temperatureC)),
      // Worded from the DEGREES, not from the points. `computeTemperatureScore`
      // is not monotonic (it falls above 30 °C), so in a heatwave the score
      // improves as the thermometer DROPS, and "sube la temperatura" would be
      // plainly false on the one day anybody checks.
      causa:
        media(temperaturas) > weather.temperatureC ? 'sube_temperatura' : 'baja_temperatura',
    });
  }

  const vientos = ventana
    .map((s) => s.windSpeedMs)
    .filter((v): v is number => typeof v === 'number');
  if (vientos.length > 0 && weather.windSpeedMs != null) {
    const futuro = media(vientos.map(computeWindScore));
    cambios.push({
      aporte: PESOS.viento * (futuro - computeWindScore(weather.windSpeedMs)),
      causa: media(vientos) < weather.windSpeedMs ? 'amaina_viento' : 'arrecia_viento',
    });
  }

  if (cambios.length === 0) return null;

  // A factor with no forecast contributes 0, which is the honest reading: no
  // evidence of change, no adjustment for it. There is nothing to renormalise
  // — the weights are shares of a real change, not parts of a whole.
  const bruto = cambios.reduce((sum, c) => sum + c.aporte, 0);
  const redondeado = Math.round(clamp(bruto, -OUTLOOK_MAX_DELTA, OUTLOOK_MAX_DELTA));

  // Below the threshold the change is noise, and noise MUST NOT move the mark:
  // a beach showing 64 whose factors add up to 63 looks broken, and the only
  // honest label for a ±1 is "no change" — which then contradicts the point it
  // silently added. Either it is worth saying, or it is worth nothing.
  const delta = Math.abs(redondeado) >= OUTLOOK_UMBRAL_TEXTO ? redondeado : 0;

  return {
    delta,
    direccion: delta >= OUTLOOK_UMBRAL_TEXTO ? 'mejora' : delta <= -OUTLOOK_UMBRAL_TEXTO ? 'empeora' : 'estable',
    horasConsideradas: ventana.length,
    causa: causaDominante(cambios, delta),
  };
}

/**
 * The factor that carries the delta: the largest contribution AMONG THOSE
 * PULLING THE SAME WAY as the total.
 *
 * The filter is the whole point. With the sky opening (+6) while the wind gets
 * up (−2) the net is an improvement, and the honest headline is the sky;
 * picking the largest absolute contribution regardless of sign would announce
 * "mejora · se levanta viento", which reads as a bug.
 */
function causaDominante(cambios: Contribucion[], delta: number): OutlookCausa | null {
  if (delta === 0) return null;

  const mismoSentido = cambios.filter((c) => Math.sign(c.aporte) === Math.sign(delta));
  if (mismoSentido.length === 0) return null;

  return mismoSentido.reduce((mayor, c) =>
    Math.abs(c.aporte) > Math.abs(mayor.aporte) ? c : mayor,
  ).causa;
}

/**
 * The outlook AS PUBLISHED, which is not the one that scores.
 *
 * Rain stays out of the delta on purpose — `RainForecast` already governs it
 * through the two score caps, and counting it twice would penalise a shower
 * once for being forecast and again for the cloud that comes with it. But
 * silence is not the answer either: a shower at 17:00 is the single fact that
 * most changes whether to go, and a card reading "mejora · se despeja" over a
 * beach capped at 59 for rain explains nothing.
 *
 * So this is presentation only: rain takes over the direction and the reason,
 * the delta is left exactly as it was, and no score moves.
 */
export function resolvePublishedOutlook(
  outlook: OutlookSignal | null | undefined,
  rainForecast: RainForecastSignal | null | undefined,
): OutlookSignal | null {
  if (!rainForecast?.expected) return outlook ?? null;

  return {
    delta: outlook?.delta ?? 0,
    direccion: 'empeora',
    horasConsideradas: outlook?.horasConsideradas ?? 0,
    causa: 'lluvia_prevista',
  };
}

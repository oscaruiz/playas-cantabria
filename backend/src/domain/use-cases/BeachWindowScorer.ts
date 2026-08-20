import type { HourlyOutlookSlot } from '../entities/RainNowcast';
import {
  computeTemperatureScore,
  computeWindScore,
  skyScoreFromCloudCover,
  SUBSCORE_MAX,
} from './BeachScorer';
import {
  FIN_FRANJA_MADRID,
  INICIO_FRANJA_MADRID,
  minutosMadrid,
  type OutlookCausa,
} from './WeatherOutlook';

/**
 * WHEN to go, not just whether: the best stretch of the remaining beach window
 * (11:00–21:00 Madrid) and the first notable turn for the worse after it.
 *
 * `WeatherOutlook` answers "is it about to get better or worse?" with a bounded
 * score delta over the next four hours. This scores the WHOLE remaining window
 * hour by hour with the same per-factor functions the score uses, so "now" and
 * "later" stay on one scale, and reduces it to two structured facts the client
 * can compose into "Mejor momento: 11:00–14:00 · a partir de las 17:00 aumenta
 * el viento". Structured on purpose: reasons are translated fragment by exact
 * fragment on the client, so an hour baked into a Spanish phrase here could
 * not be translated at all.
 *
 * Tides and UV stay out, by the same criterion the score applies to UV: they
 * are information for the beach page, not a penalty — and tides only exist on
 * the detail's scraper, not in the featured fan-out.
 */

/** Absolute floor (normalized 0–100) below which no hour is ever recommended:
 *  "mejor momento" means good, not the least bad hour of a bad day. */
const UMBRAL_CALIDAD = 60;

/**
 * How far below the day's own peak an hour may fall and still belong to the
 * best stretch. The bar is RELATIVE on purpose: an absolute one cannot see the
 * change that matters most on this coast — clear sky and 24° with a gale still
 * normalizes to ~77 (wind is 15 of 65 points), so "a partir de las 17:00
 * aumenta el viento" would never be said. Twelve points keeps one sky band
 * (01d→02d, −4.6) and a light breeze pickup (−4.6) inside the stretch, and
 * pushes a closed sky (−13.8) or a real blow (−20) out of it.
 */
const MARGEN_PICO = 12;

export interface DayWindowSignal {
  /** Best contiguous stretch, in epoch ms (end = last slot + step, clipped to the window). */
  mejor: { inicio: number; fin: number };
  /**
   * First slot after the stretch that stops being good, and the factor that
   * broke it. Null when the stretch runs to the end of the beach window.
   * Only worsening causes can appear here (never `despeja`/`amaina_viento`/
   * `sube_temperatura`): it names why the good stretch ENDS.
   */
  cambio: { desde: number; causa: OutlookCausa } | null;
  /** Usable slots the verdict is built on — the honest depth of the forecast. */
  horasConsideradas: number;
}

interface SlotEvaluado {
  timestamp: number;
  /** Normalized 0–100 over the factors this slot actually carries. 0 if wet. */
  calidad: number;
  mojado: boolean;
  cielo: number | null;
  temperatura: number | null;
  viento: number | null;
}

function evaluarSlot(slot: HourlyOutlookSlot): SlotEvaluado | null {
  const mojado = (slot.precipitationMm ?? 0) > 0;

  const cielo = slot.cloudCoverPct != null ? skyScoreFromCloudCover(slot.cloudCoverPct) : null;
  const temperatura =
    slot.temperatureC != null ? computeTemperatureScore(slot.temperatureC) : null;
  const viento = slot.windSpeedMs != null ? computeWindScore(slot.windSpeedMs) : null;

  let suma = 0;
  let maximo = 0;
  if (cielo != null) { suma += cielo; maximo += SUBSCORE_MAX.cielo; }
  if (temperatura != null) { suma += temperatura; maximo += SUBSCORE_MAX.temperatura; }
  if (viento != null) { suma += viento; maximo += SUBSCORE_MAX.viento; }

  // A slot with no usable variable cannot be certified good OR bad: it is not
  // part of the analysis at all (and it breaks contiguity — see below).
  if (maximo === 0) return null;

  return {
    timestamp: slot.timestamp,
    // Wet hours can never belong to the best time to go, whatever the sky
    // says: the same philosophy as the score's rain caps.
    calidad: mojado ? 0 : Math.round((suma / maximo) * 100),
    mojado,
    cielo,
    temperatura,
    viento,
  };
}

/** The slot step, from the smallest positive gap: 1h from Open-Meteo, 3h from
 *  OpenWeather's forecast. Both are real sources of these slots. */
function pasoDeSlots(slots: readonly HourlyOutlookSlot[]): number {
  let paso = Number.POSITIVE_INFINITY;
  for (let i = 1; i < slots.length; i++) {
    const gap = slots[i].timestamp - slots[i - 1].timestamp;
    if (gap > 0 && gap < paso) paso = gap;
  }
  return Number.isFinite(paso) ? paso : 60 * 60_000;
}

function media(valores: number[]): number {
  return valores.reduce((sum, v) => sum + v, 0) / valores.length;
}

/**
 * Builds the day window. Returns null when there is nothing honest to say:
 * fewer than two usable slots, the beach window already over, or no stretch
 * good enough to recommend — recommending the least bad hour of a bad day
 * would dress a warning up as advice.
 */
export function buildDayWindow(
  slots: readonly HourlyOutlookSlot[] | null | undefined,
  ahora: Date = new Date(),
): DayWindowSignal | null {
  if (!slots || slots.length === 0) return null;

  // Same intersection arithmetic as `ventanaOutlook`, without the 4h ceiling:
  // offsets from "now", so it cannot slip a day at either end.
  const minutosAhora = minutosMadrid(ahora);
  const desdeMin = Math.max(minutosAhora, INICIO_FRANJA_MADRID);
  const hastaMin = FIN_FRANJA_MADRID;
  if (hastaMin <= desdeMin) return null;
  const desde = ahora.getTime() + (desdeMin - minutosAhora) * 60_000;
  const hasta = ahora.getTime() + (hastaMin - minutosAhora) * 60_000;

  const ordenados = [...slots].sort((a, b) => a.timestamp - b.timestamp);
  const enFranja = ordenados.filter((s) => s.timestamp > desde && s.timestamp <= hasta);
  const evaluados = enFranja
    .map(evaluarSlot)
    .filter((s): s is SlotEvaluado => s !== null);
  if (evaluados.length < 2) return null;

  const paso = pasoDeSlots(enFranja);

  // The bar every recommended hour must clear: near the day's own best hour,
  // never below the absolute floor. See `MARGEN_PICO` for why it is relative.
  const pico = Math.max(...evaluados.map((s) => s.calidad));
  const liston = Math.max(UMBRAL_CALIDAD, pico - MARGEN_PICO);

  // Contiguous runs of good slots. A missing or unusable slot breaks the run:
  // a stretch is only recommended over hours that were actually certified.
  const tramos: SlotEvaluado[][] = [];
  let actual: SlotEvaluado[] = [];
  for (const slot of evaluados) {
    const contiguo =
      actual.length > 0 && slot.timestamp - actual[actual.length - 1].timestamp === paso;
    if (slot.calidad >= liston) {
      if (actual.length > 0 && !contiguo) { tramos.push(actual); actual = []; }
      actual.push(slot);
    } else if (actual.length > 0) {
      tramos.push(actual);
      actual = [];
    }
  }
  if (actual.length > 0) tramos.push(actual);
  if (tramos.length === 0) return null;

  // Longest stretch; ties go to the higher mean, then to the earlier one —
  // "go now rather than wait" is the useful advice when both are equal.
  const mejorTramo = tramos.reduce((mejor, tramo) => {
    if (tramo.length !== mejor.length) return tramo.length > mejor.length ? tramo : mejor;
    const mediaTramo = media(tramo.map((s) => s.calidad));
    const mediaMejor = media(mejor.map((s) => s.calidad));
    if (mediaTramo !== mediaMejor) return mediaTramo > mediaMejor ? tramo : mejor;
    return mejor;
  });

  const inicio = mejorTramo[0].timestamp;
  const fin = Math.min(mejorTramo[mejorTramo.length - 1].timestamp + paso, hasta);

  return {
    mejor: { inicio, fin },
    cambio: buscarCambio(evaluados, mejorTramo, liston),
    horasConsideradas: evaluados.length,
  };
}

/**
 * The first slot after the best stretch that stops being good, named by the
 * factor that fell the most against the stretch's own mean. Null when the
 * stretch reaches the last evaluated slot: nothing after it to warn about.
 */
function buscarCambio(
  evaluados: readonly SlotEvaluado[],
  tramo: readonly SlotEvaluado[],
  liston: number,
): { desde: number; causa: OutlookCausa } | null {
  const finTramo = tramo[tramo.length - 1].timestamp;
  const siguiente = evaluados.find(
    (s) => s.timestamp > finTramo && s.calidad < liston,
  );
  if (!siguiente) return null;

  if (siguiente.mojado) return { desde: siguiente.timestamp, causa: 'lluvia_prevista' };

  const mediaDe = (lee: (s: SlotEvaluado) => number | null): number | null => {
    const valores = tramo.map(lee).filter((v): v is number => v != null);
    return valores.length > 0 ? media(valores) : null;
  };

  // Drop per factor in points of the score, so the widest factor (sky, 25)
  // can dominate exactly as it does in the mark itself.
  const caidas: Array<{ causa: OutlookCausa; caida: number }> = [];
  const cieloMedio = mediaDe((s) => s.cielo);
  if (cieloMedio != null && siguiente.cielo != null) {
    caidas.push({ causa: 'nubla', caida: cieloMedio - siguiente.cielo });
  }
  const tempMedia = mediaDe((s) => s.temperatura);
  if (tempMedia != null && siguiente.temperatura != null) {
    caidas.push({ causa: 'baja_temperatura', caida: tempMedia - siguiente.temperatura });
  }
  const vientoMedio = mediaDe((s) => s.viento);
  if (vientoMedio != null && siguiente.viento != null) {
    caidas.push({ causa: 'arrecia_viento', caida: vientoMedio - siguiente.viento });
  }

  const peor = caidas
    .filter((c) => c.caida > 0)
    .reduce<{ causa: OutlookCausa; caida: number } | null>(
      (max, c) => (max == null || c.caida > max.caida ? c : max),
      null,
    );
  // The slot failed the bar but no single factor fell against the stretch —
  // e.g. the stretch was barely above it. Nothing nameable, nothing said.
  if (!peor) return null;

  return { desde: siguiente.timestamp, causa: peor.causa };
}

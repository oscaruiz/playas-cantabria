import type { HourlyOutlookSlot, RainNowcast } from '../entities/RainNowcast';
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

/**
 * Why the winning stretch beats the hours it rejected, named by the dominant
 * advantage. `sin_lluvia` wins outright whenever any rejected hour is wet —
 * dodging the rain is the fact that changes the plan; the other three reuse
 * the improving half of the `OutlookCausa` vocabulary so the client already
 * knows how to phrase them.
 */
export type MotivoVentana = 'sin_lluvia' | 'despeja' | 'sube_temperatura' | 'amaina_viento';

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
  /**
   * Why THIS stretch and not the rest of the day. Null when the stretch covers
   * every evaluated hour (there is nothing it beat) or when no single factor
   * stands out against the rejected hours.
   */
  motivo: MotivoVentana | null;
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
  lluviaAhora?: Pick<RainNowcast, 'status'> | null,
): DayWindowSignal | null {
  if (!slots || slots.length === 0) return null;

  const franja = franjaRestante(ahora);
  if (!franja) return null;
  const { desde, hasta } = franja;

  const ordenados = [...slots].sort((a, b) => a.timestamp - b.timestamp);
  const paso = pasoDeSlots(ordenados);
  // A slot belongs to the analysis while its INTERVAL overlaps the remaining
  // window, not only when it starts inside it: dropping the in-progress slot
  // meant the window could never start "now" even when now was the best hour.
  const enFranja = ordenados.filter((s) => s.timestamp + paso > desde && s.timestamp <= hasta);

  // Rain detected NOW (the aggregated multi-source nowcast) overrides the
  // model for the next hour: these slots said "dry" while it was actually
  // raining, so their claim is already disproved — the window must never
  // recommend going out into rain the forecast cannot see. One hour is the
  // minimum persistence an active event deserves; while it keeps raining the
  // short cache TTLs slide this veto forward on every refresh. Same
  // philosophy as the score's rain cap, and it costs zero extra calls: both
  // callers already hold the nowcast.
  const vetoHasta =
    lluviaAhora?.status === 'raining' ? ahora.getTime() + 60 * 60_000 : null;

  const evaluados = enFranja
    .map(evaluarSlot)
    .filter((s): s is SlotEvaluado => s !== null)
    .map((s) =>
      vetoHasta != null && s.timestamp < vetoHasta ? { ...s, mojado: true, calidad: 0 } : s,
    );
  if (evaluados.length < 2) return null;

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

  // The in-progress slot may start before "now": clamp so the published
  // stretch never announces a start in the past.
  const inicio = Math.max(mejorTramo[0].timestamp, desde);
  const fin = Math.min(mejorTramo[mejorTramo.length - 1].timestamp + paso, hasta);

  return {
    mejor: { inicio, fin },
    cambio: buscarCambio(evaluados, mejorTramo, liston),
    motivo: buscarMotivo(evaluados, mejorTramo),
    horasConsideradas: evaluados.length,
  };
}

/**
 * The remaining beach window as epoch bounds. Same intersection arithmetic as
 * `ventanaOutlook`, without the 4h ceiling: offsets from "now", so it cannot
 * slip a day at either end. Null once the window is over for today.
 */
export function franjaRestante(ahora: Date): { desde: number; hasta: number } | null {
  const minutosAhora = minutosMadrid(ahora);
  const desdeMin = Math.max(minutosAhora, INICIO_FRANJA_MADRID);
  const hastaMin = FIN_FRANJA_MADRID;
  if (hastaMin <= desdeMin) return null;
  return {
    desde: ahora.getTime() + (desdeMin - minutosAhora) * 60_000,
    hasta: ahora.getTime() + (hastaMin - minutosAhora) * 60_000,
  };
}

/**
 * Trims hourly slots to the remaining beach window — the strip the detail
 * shows under "what's left of the day". Kept API-compatible with the verdict
 * above (same bounds, same in-progress-slot rule) so the hours the user sees
 * are exactly the hours the window judged.
 */
export function recortarAFranjaRestante(
  slots: readonly HourlyOutlookSlot[],
  ahora: Date = new Date(),
): HourlyOutlookSlot[] {
  if (slots.length === 0) return [];
  const franja = franjaRestante(ahora);
  if (!franja) return [];
  const ordenados = [...slots].sort((a, b) => a.timestamp - b.timestamp);
  const paso = pasoDeSlots(ordenados);
  return ordenados.filter((s) => s.timestamp + paso > franja.desde && s.timestamp <= franja.hasta);
}

/**
 * Why the winning stretch beats the hours it rejected. Rain outside the
 * stretch decides on its own; otherwise the factor with the widest mean
 * advantage (in score points, same scale as `buscarCambio`) gives its name.
 */
function buscarMotivo(
  evaluados: readonly SlotEvaluado[],
  tramo: readonly SlotEvaluado[],
): MotivoVentana | null {
  const fuera = evaluados.filter((s) => !tramo.includes(s));
  if (fuera.length === 0) return null;

  if (fuera.some((s) => s.mojado)) return 'sin_lluvia';

  const mediaDe = (
    lista: readonly SlotEvaluado[],
    lee: (s: SlotEvaluado) => number | null,
  ): number | null => {
    const valores = lista.map(lee).filter((v): v is number => v != null);
    return valores.length > 0 ? media(valores) : null;
  };

  const ventajas: Array<{ motivo: MotivoVentana; ventaja: number }> = [];
  const factores: Array<{ motivo: MotivoVentana; lee: (s: SlotEvaluado) => number | null }> = [
    { motivo: 'despeja', lee: (s) => s.cielo },
    { motivo: 'sube_temperatura', lee: (s) => s.temperatura },
    { motivo: 'amaina_viento', lee: (s) => s.viento },
  ];
  for (const { motivo, lee } of factores) {
    const dentro = mediaDe(tramo, lee);
    const resto = mediaDe(fuera, lee);
    if (dentro != null && resto != null) ventajas.push({ motivo, ventaja: dentro - resto });
  }

  const mejor = ventajas
    .filter((v) => v.ventaja > 0)
    .reduce<{ motivo: MotivoVentana; ventaja: number } | null>(
      (max, v) => (max == null || v.ventaja > max.ventaja ? v : max),
      null,
    );
  return mejor?.motivo ?? null;
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

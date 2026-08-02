import { Weather } from '../entities/Weather';
import { SunshineObservation } from '../entities/Sunshine';

/**
 * Corrects the model's sky when the OBSERVED sunshine contradicts it.
 *
 * The motivating case: on 29-jul, with the whole coast overcast, OpenWeather
 * returned `id 800` and `clouds.all: 0` for the 46 beaches and the app showed
 * "Sol, 26°" and ☀️. The mapping wasn't failing: the source was. And
 * cross-checking against another model was no use, because Open-Meteo, met.no
 * and AEMET's beach forecast share the blind spot (a marine stratus layer fits
 * inside a cell of their grid). Station sunshine is the only signal that does
 * not come from a model: that day it recorded 0 minutes of sun from 05:00 to
 * 08:00 UTC.
 *
 * PURE module on purpose: no HTTP, no cache, no config and no clock of its own.
 * Everything it decides on comes in as a parameter, so the guards can be tested
 * exhaustively without spinning anything up. Same pattern as `flagAggregation.ts`.
 */

/** Sky levels supported by the correction, with OpenWeather-compatible icons. */
const NIVELES = {
  despejado: { descripcion: 'cielo claro', icono: '01d', severidad: 0 },
  dispersas: { descripcion: 'nubes dispersas', icono: '03d', severidad: 2 },
  muyNuboso: { descripcion: 'muy nuboso', icono: '04d', severidad: 3 },
} as const;

export type NivelCorregido = keyof typeof NIVELES;

/**
 * Severity of the sky the model reports, on the OpenWeather icon scale.
 * Only "no-phenomenon" skies are mapped: rain, storm, snow and fog are left
 * out on purpose, and since they are not in the table they are never corrected
 * (see the `modelo-ya-nublado` guard). A rain icon must always win.
 */
const SEVERIDAD_MODELO: Record<string, number> = {
  '01d': 0, '01n': 0, // clear
  '02d': 1, '02n': 1, // a few clouds
  '03d': 2, '03n': 2, // scattered clouds
  '04d': 3, '04n': 3, // overcast
};

/** Beyond this the station no longer says anything useful about that beach. */
const MAX_KM = 40;
/** Below this one station is enough; above it two are required. */
const KM_SIN_CORROBORAR = 30;
/** Improving a cloudy model needs a closer station than worsening it. */
const MAX_KM_PARA_MEJORAR = 25;
/**
 * The AEMET observation is hourly, but `getOrSetStale` can serve the payload
 * for up to 3 h (TTL ×6) if AEMET goes down. Without this guard we could mark
 * "nublado" based on a three-hour-old observation.
 */
const FRESCURA_MAX_MS = 2 * 60 * 60 * 1000;

/** Below 1/4 of an hour of sun the sky is genuinely covered. */
const UMBRAL_MUY_NUBOSO = 0.25;
/** Between this and the clear threshold the signal is intentionally inconclusive. */
const UMBRAL_SIN_TOCAR = 0.75;
/** Strong sunshine can disprove a cloudy current observation. */
const UMBRAL_DESPEJADO = 0.85;
/** Moderate sunshine is enough only when the immediate local model also says clear. */
const UMBRAL_SOL_CON_CORROBORACION = 0.5;
const UMBRAL_NUBES_DESPEJADO = 10;

export type MotivoDecision =
  | 'corregido'
  | 'sin-weather'
  | 'fuera-de-franja'
  | 'sin-observacion'
  | 'observacion-vieja'
  | 'estacion-lejos'
  | 'estacion-lejos-para-mejorar'
  | 'sin-segundo-testigo'
  | 'lloviendo'
  | 'modelo-ya-nublado'
  | 'sol-suficiente';

export interface ContextoCorreccion {
  /** Only corrected during day/afternoon. See note in the corresponding guard. */
  enFranjaDePlaya: boolean;
  ahora: number;
  /** External rain signal (nowcast); the one in `weather` itself is already checked. */
  lloviendo?: boolean;
  /** Nearest Open-Meteo hourly slot (max 90 min away), used only as corroboration. */
  nubesInmediatasPct?: number | null;
}

export interface DecisionCielo {
  aplicar: boolean;
  motivo: MotivoDecision;
  nivel?: NivelCorregido;
  /** Data for shadow-mode diagnostics. */
  idema?: string;
  distanciaKm?: number;
  fraccion?: number;
}

/** Sky level supported by the sunshine fraction, or null in the uncertain band. */
function nivelPara(fraccion: number): NivelCorregido | null {
  if (fraccion < UMBRAL_MUY_NUBOSO) return 'muyNuboso';
  if (fraccion <= UMBRAL_SIN_TOCAR) return 'dispersas';
  if (fraccion >= UMBRAL_DESPEJADO) return 'despejado';
  return null;
}

function modeloDiceLluvia(weather: Weather): boolean {
  // 2xx storm, 3xx drizzle, 5xx rain, 6xx snow on the OpenWeather scale.
  const c = weather.conditionCode;
  if (typeof c === 'number' && c >= 200 && c < 700) return true;
  return typeof weather.precipitationMm === 'number' && weather.precipitationMm > 0;
}

/**
 * Decides WITHOUT applying anything. Separated from `aplicarCorreccionCielo` so
 * that shadow mode can record exactly what it would have done without touching
 * the response.
 */
export function decidirCorreccionCielo(
  weather: Weather | null,
  observaciones: readonly SunshineObservation[],
  ctx: ContextoCorreccion,
): DecisionCielo {
  if (!weather) return { aplicar: false, motivo: 'sin-weather' };

  // 1. Day and afternoon only. Besides being the only thing the app cares
  // about, this removes the worst edge case: in the hour containing sunrise the
  // sunshine reading comes out low even if the sky is spotless, simply because
  // the sun was below the horizon for part of that hour. Starting at 11:00
  // Madrid time that cannot happen.
  if (!ctx.enFranjaDePlaya) return { aplicar: false, motivo: 'fuera-de-franja' };

  // They arrive sorted by distance: the first one decides, the rest are witnesses.
  const observacion = observaciones[0];
  if (!observacion) return { aplicar: false, motivo: 'sin-observacion' };

  const base = {
    idema: observacion.idema,
    distanciaKm: observacion.distanciaKm,
    fraccion: observacion.fraccion,
  };

  // 2. Freshness (see FRESCURA_MAX_MS).
  if (ctx.ahora - observacion.observadoEn > FRESCURA_MAX_MS) {
    return { aplicar: false, motivo: 'observacion-vieja', ...base };
  }

  // 3. Rain: the rain icon wins, we do not overwrite it with a clouds one.
  if (ctx.lloviendo || modeloDiceLluvia(weather)) {
    return { aplicar: false, motivo: 'lloviendo', ...base };
  }

  // 4. Distance.
  if (observacion.distanciaKm > MAX_KM) {
    return { aplicar: false, motivo: 'estacion-lejos', ...base };
  }

  // 5. Low sunshine can expose swallowed stratus. Very high sunshine can also
  // disprove a cloudy current observation; the gap between both thresholds is
  // intentionally inconclusive.
  const despejadoCorroborado =
    observacion.fraccion >= UMBRAL_SOL_CON_CORROBORACION
    && typeof ctx.nubesInmediatasPct === 'number'
    && ctx.nubesInmediatasPct <= UMBRAL_NUBES_DESPEJADO;
  const nivel = despejadoCorroborado ? 'despejado' : nivelPara(observacion.fraccion);
  if (!nivel) return { aplicar: false, motivo: 'sol-suficiente', ...base };

  // Improving a cloudy model is useful, but more geographically sensitive
  // than detecting a widespread stratus layer. Require a closer station and
  // stronger sunshine than the downgrade path.
  const esMejora = nivel === 'despejado';
  const severidadModelo = weather.icon ? SEVERIDAD_MODELO[weather.icon] : undefined;
  if (esMejora && severidadModelo === NIVELES.despejado.severidad) {
    return { aplicar: false, motivo: 'sol-suficiente', ...base };
  }
  if (esMejora && observacion.distanciaKm > MAX_KM_PARA_MEJORAR) {
    return { aplicar: false, motivo: 'estacion-lejos-para-mejorar', ...base };
  }

  // 6. Between 30 and 40 km a second witness is required. A stratus layer is a
  // long, coherent band along the coast, so if it really is covered more than
  // one station will be seeing it; requiring two avoids correcting half the
  // province because of a dirty or broken sensor.
  if (!esMejora && observacion.distanciaKm > KM_SIN_CORROBORAR) {
    // The witness has to see AT LEAST as much cloud as the main station.
    // A simple "not clear" was not enough: a station with 44 of the 60 minutes
    // of sun would have validated a "muy nuboso", which is exactly the opposite
    // of what it confirms.
    const corrobora = observaciones.some((o) => {
      if (o.idema === observacion.idema) return false;
      if (ctx.ahora - o.observadoEn > FRESCURA_MAX_MS) return false;
      const suNivel = nivelPara(o.fraccion);
      return !!suNivel && NIVELES[suNivel].severidad >= NIVELES[nivel].severidad;
    });
    if (!corrobora) return { aplicar: false, motivo: 'sin-segundo-testigo', ...base };
  }

  // 7. Low/intermittent sunshine only worsens the model. Strong sunshine is
  // the sole case allowed to improve it. Phenomena outside the cloud scale
  // (rain, fog, snow) are never replaced.
  if (
    severidadModelo === undefined
    || severidadModelo === NIVELES[nivel].severidad
    || (!esMejora && severidadModelo > NIVELES[nivel].severidad)
  ) {
    return { aplicar: false, motivo: 'modelo-ya-nublado', ...base };
  }

  return { aplicar: true, motivo: 'corregido', nivel, ...base };
}

/**
 * Returns a copy of the `Weather` with the observed sky correction. Temperature, wind,
 * humidity and pressure are preserved: only the sky is disputed.
 *
 * `source` is kept INTACT on purpose: `buildRankingReason` in BeachScorer only
 * uses the description if `source === 'OpenWeather'`, so changing it here would
 * leave the ranking reason without the sky part.
 */
export function aplicarCorreccionCielo(weather: Weather, decision: DecisionCielo): Weather {
  if (!decision.aplicar || !decision.nivel) return weather;
  const nivel = NIVELES[decision.nivel];
  return { ...weather, description: nivel.descripcion, icon: nivel.icono };
}

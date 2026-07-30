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

/** Sky level it can be downgraded to, with its icon on the OpenWeather scale. */
const NIVELES = {
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
/**
 * The AEMET observation is hourly, but `getOrSetStale` can serve the payload
 * for up to 3 h (TTL ×6) if AEMET goes down. Without this guard we could mark
 * "nublado" based on a three-hour-old observation.
 */
const FRESCURA_MAX_MS = 2 * 60 * 60 * 1000;

/** Below 1/4 of an hour of sun the sky is genuinely covered. */
const UMBRAL_MUY_NUBOSO = 0.25;
/** Above 3/4 the morning is sunny and there is nothing to correct. */
const UMBRAL_SIN_TOCAR = 0.75;

export type MotivoDecision =
  | 'corregido'
  | 'sin-weather'
  | 'fuera-de-franja'
  | 'sin-observacion'
  | 'observacion-vieja'
  | 'estacion-lejos'
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

/** Level that sun fraction would downgrade to, or null if nothing needs touching. */
function nivelPara(fraccion: number): NivelCorregido | null {
  if (fraccion < UMBRAL_MUY_NUBOSO) return 'muyNuboso';
  if (fraccion <= UMBRAL_SIN_TOCAR) return 'dispersas';
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

  // 5. Enough sun: we do not correct, and we do not "improve" a cloudy sky
  // either. The documented failure always goes one way —the models swallow the
  // stratus, they do not invent clouds— so the correction is one-directional.
  const nivel = nivelPara(observacion.fraccion);
  if (!nivel) return { aplicar: false, motivo: 'sol-suficiente', ...base };

  // 6. Between 30 and 40 km a second witness is required. A stratus layer is a
  // long, coherent band along the coast, so if it really is covered more than
  // one station will be seeing it; requiring two avoids correcting half the
  // province because of a dirty or broken sensor.
  if (observacion.distanciaKm > KM_SIN_CORROBORAR) {
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

  // 7. Downgrade only. If the model already reports something equally or more
  // cloudy, or a phenomenon not in the table (rain, fog, snow), leave it alone.
  const severidadModelo = weather.icon ? SEVERIDAD_MODELO[weather.icon] : undefined;
  if (severidadModelo === undefined || severidadModelo >= NIVELES[nivel].severidad) {
    return { aplicar: false, motivo: 'modelo-ya-nublado', ...base };
  }

  return { aplicar: true, motivo: 'corregido', nivel, ...base };
}

/**
 * Returns a copy of the `Weather` with the sky downgraded. Temperature, wind,
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

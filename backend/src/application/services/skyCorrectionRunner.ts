import { Weather } from '../../domain/entities/Weather';
import { SunshineObservation } from '../../domain/entities/Sunshine';
import { decidirCorreccionCielo, aplicarCorreccionCielo } from '../../domain/services/skyCorrection';
import { enFranjaDePlaya, skyCorrectionMode } from '../../infrastructure/config/config';
import { skyCorrectionMetrics } from '../../infrastructure/observability/skyCorrectionMetrics';

/**
 * Aplica (o solo registra) la corrección de cielo por insolación observada.
 *
 * Vive aquí y no en cada llamante porque el listado y el detalle deben usar
 * EXACTAMENTE el mismo criterio: si divergen, la tarjeta y la cabecera de la
 * misma playa acabarían diciendo cosas distintas. La decisión en sí es pura y
 * está en `domain/services/skyCorrection`; esto solo le pone reloj, modo y
 * contadores.
 *
 * En modo `shadow` decide y cuenta, pero devuelve el `Weather` sin tocar.
 */
export function corregirCieloObservado(
  playa: string,
  weather: Weather | null,
  sol: readonly SunshineObservation[],
  lloviendo: boolean,
  ahora: number = Date.now(),
): Weather | null {
  const modo = skyCorrectionMode();
  if (modo === 'off' || !weather) return weather;

  const decision = decidirCorreccionCielo(weather, sol, {
    enFranjaDePlaya: enFranjaDePlaya(new Date(ahora)),
    ahora,
    lloviendo,
  });
  skyCorrectionMetrics.record(playa, decision);

  return modo === 'on' ? aplicarCorreccionCielo(weather, decision) : weather;
}

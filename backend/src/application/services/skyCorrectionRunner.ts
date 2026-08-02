import { Weather } from '../../domain/entities/Weather';
import { SunshineObservation } from '../../domain/entities/Sunshine';
import type { HourlyOutlookSlot } from '../../domain/entities/RainNowcast';
import { decidirCorreccionCielo, aplicarCorreccionCielo } from '../../domain/services/skyCorrection';
import { enFranjaDePlaya, skyCorrectionMode } from '../../infrastructure/config/config';
import { skyCorrectionMetrics } from '../../infrastructure/observability/skyCorrectionMetrics';

/**
 * Applies (or only records) the sky correction from observed sunshine.
 *
 * It lives here and not in each caller because the listing and the detail must
 * use EXACTLY the same criterion: if they diverge, the card and the header of
 * the same beach would end up saying different things. The decision itself is
 * pure and lives in `domain/services/skyCorrection`; this only adds clock, mode
 * and counters.
 *
 * In `shadow` mode it decides and counts, but returns the `Weather` untouched.
 */
export function corregirCieloObservado(
  playa: string,
  weather: Weather | null,
  sol: readonly SunshineObservation[],
  lloviendo: boolean,
  ahora: number = Date.now(),
  outlook: readonly HourlyOutlookSlot[] | null = null,
): Weather | null {
  const modo = skyCorrectionMode();
  if (modo === 'off' || !weather) return weather;

  const evidencia = evidenciaHoraria(outlook, ahora);
  const decision = decidirCorreccionCielo(weather, sol, {
    enFranjaDePlaya: enFranjaDePlaya(new Date(ahora)),
    ahora,
    lloviendo,
    nubesInmediatasPct: evidencia.nubesInmediatasPct,
    horasDespejadasConsecutivas: evidencia.horasDespejadasConsecutivas,
  });
  skyCorrectionMetrics.record(playa, decision);

  return modo === 'on' ? aplicarCorreccionCielo(weather, decision) : weather;
}

/** The next hourly slot is corroboration only while it still describes "now". */
function evidenciaHoraria(
  outlook: readonly HourlyOutlookSlot[] | null,
  ahora: number,
): { nubesInmediatasPct: number | null; horasDespejadasConsecutivas: number } {
  const HORA_MS = 60 * 60 * 1000;
  const LIMITE_INMEDIATO_MS = 90 * 60 * 1000;
  const slots = [...(outlook ?? [])]
    .filter((item) =>
      item.timestamp >= ahora
      && item.timestamp - ahora <= 4 * HORA_MS
      && typeof item.cloudCoverPct === 'number')
    .sort((a, b) => a.timestamp - b.timestamp);
  const inmediato = slots[0];
  if (!inmediato || inmediato.timestamp - ahora > LIMITE_INMEDIATO_MS) {
    return { nubesInmediatasPct: null, horasDespejadasConsecutivas: 0 };
  }

  let consecutivas = 0;
  let anterior: number | null = null;
  for (const slot of slots) {
    if (anterior !== null && slot.timestamp - anterior > 90 * 60 * 1000) break;
    if ((slot.cloudCoverPct ?? 100) > 10) break;
    consecutivas += 1;
    anterior = slot.timestamp;
  }
  return {
    nubesInmediatasPct: inmediato.cloudCoverPct,
    horasDespejadasConsecutivas: consecutivas,
  };
}

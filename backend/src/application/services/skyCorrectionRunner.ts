import { Weather } from '../../domain/entities/Weather';
import { SunshineObservation } from '../../domain/entities/Sunshine';
import type { HourlyOutlookSlot } from '../../domain/entities/RainNowcast';
import {
  decidirCorreccionCielo,
  aplicarCorreccionCielo,
  DecisionCielo,
} from '../../domain/services/skyCorrection';
import { Config, enFranjaDePlaya, skyCorrectionMode } from '../../infrastructure/config/config';
import { CacheKeys } from '../../infrastructure/cache/InMemoryCache';
import { skyCorrectionMetrics } from '../../infrastructure/observability/skyCorrectionMetrics';

/**
 * Where a taken decision is remembered so every caller reuses it. Structural,
 * so `InMemoryCache` satisfies it without this module depending on it.
 */
export interface MemoriaDecisionCielo {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttlSeconds: number): void;
}

/**
 * Applies (or only records) the sky correction from observed sunshine.
 *
 * It lives here and not in each caller because the listing and the detail must
 * use EXACTLY the same criterion: if they diverge, the card and the header of
 * the same beach would end up saying different things. The decision itself is
 * pure and lives in `domain/services/skyCorrection`; this only adds clock, mode
 * and counters.
 *
 * Sharing the criterion was not enough. Both callers read the SAME cached
 * OpenWeather observation, but each decided at its own instant with its own
 * snapshot of the sunshine, so the listing could show the sky from before a
 * correction while the detail showed the one after it — the same beach saying
 * two things on two screens. With `memoria` the FIRST caller decides and the
 * rest reuse that decision until it expires, which is what makes both screens
 * agree instead of merely agreeing on how to disagree.
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
  memoria?: MemoriaDecisionCielo,
  regionId = 'cantabria',
): Weather | null {
  const modo = skyCorrectionMode();
  if (modo === 'off' || !weather) return weather;

  // The model's icon and the rain are in the key because the decision guards
  // on them: reusing a decision taken for a different sky would be worse than
  // taking a fresh one.
  const clave = CacheKeys.skyDecision(regionId, playa, weather.icon ?? '', lloviendo);
  const recordada = memoria?.get<DecisionCielo>(clave);

  let decision: DecisionCielo;
  if (recordada) {
    decision = recordada;
  } else {
    const evidencia = evidenciaHoraria(outlook, ahora);
    decision = decidirCorreccionCielo(weather, sol, {
      enFranjaDePlaya: enFranjaDePlaya(new Date(ahora)),
      ahora,
      lloviendo,
      nubesInmediatasPct: evidencia.nubesInmediatasPct,
      horasDespejadasConsecutivas: evidencia.horasDespejadasConsecutivas,
    });
    // Counted only when a decision is actually TAKEN. Counting reuses would
    // multiply the same call by however many screens looked at the beach, and
    // `/api/_diag/sky` exists to judge the criterion, not the traffic.
    skyCorrectionMetrics.record(playa, decision);
    memoria?.set(clave, decision, Config.skyDecisionTtlSeconds());
  }

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

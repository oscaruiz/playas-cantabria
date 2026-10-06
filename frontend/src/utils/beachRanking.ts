/**
 * Ranking of featured beaches for the Home: combines the backend's
 * score (which doesn't know the user's location) with the distance
 * computed on the client, using a single sort key that is therefore
 * transitive (unlike the previous pairwise comparator).
 */

import { haversineKm } from '../shared/geo/haversine';

// Calibration: a nearby beach can lead over another with more points
// (78@15km beats 84@33km), but the cap prevents distance from dominating:
// from 62.5 km on they all get penalized equally and the raw score decides.
export const PENALIZACION_PTS_POR_KM = 0.4;
export const PENALIZACION_MAX_PTS = 25;

/** Internal sort score. NEVER shown in the UI (the UI always displays the raw score). */
export function adjustedScore(score: number, distKm: number): number {
  if (!Number.isFinite(distKm)) return score;
  return score - Math.min(distKm * PENALIZACION_PTS_POR_KM, PENALIZACION_MAX_PTS);
}

/** Structural subset of FeaturedBeach — the minimum the ranking needs. */
export interface RankableBeach {
  codigo: string;
  nombre: string;
  lat: number;
  lon: number;
  puntuacion: number;
}

function compareTiebreak(a: RankableBeach, b: RankableBeach): number {
  return b.puntuacion - a.puntuacion || a.nombre.localeCompare(b.nombre, 'es');
}

/**
 * Sorts the pool transitively and deterministically. With a location, by
 * distance-adjusted score desc; without it, by raw score desc.
 * Tiebreakers: score desc, then name. Does not mutate the input array.
 */
export function rankBeaches<T extends RankableBeach>(
  pool: T[],
  userLocation: [number, number] | null,
  max = 5
): T[] {
  if (!userLocation) {
    return [...pool].sort(compareTiebreak).slice(0, max);
  }
  const [uLat, uLon] = userLocation;
  return pool
    .map((beach) => ({
      playa: beach,
      ajustado: adjustedScore(beach.puntuacion, haversineKm(uLat, uLon, beach.lat, beach.lon)),
    }))
    .sort((a, b) => b.ajustado - a.ajustado || compareTiebreak(a.playa, b.playa))
    .slice(0, max)
    .map((d) => d.playa);
}

/**
 * Code of the displayed (non-hero) beach with the highest raw score, ONLY if
 * it strictly beats the hero; null if the hero already is (or ties with) the
 * maximum. Serves both to enable the hero's "priorizada por cercanía" note
 * and the "mejor puntuación" chip on that alternative.
 */
export function topScoreCodeNoHero(sorted: RankableBeach[]): string | null {
  if (sorted.length < 2) return null;
  const hero = sorted[0];
  let best: RankableBeach | null = null;
  for (const beach of sorted.slice(1)) {
    if (!best || beach.puntuacion > best.puntuacion) best = beach;
  }
  return best && best.puntuacion > hero.puntuacion ? best.codigo : null;
}

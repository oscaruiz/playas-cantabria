/**
 * Ranking of featured beaches for the Home: combines the backend's
 * score (which doesn't know the user's location) with the distance
 * computed on the client, using a single sort key that is therefore
 * transitive (unlike the previous pairwise comparator).
 */

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Calibration: a nearby beach can lead over another with more points
// (78@15km beats 84@33km), but the cap prevents distance from dominating:
// from 62.5 km on they all get penalized equally and the raw score decides.
export const PENALIZACION_PTS_POR_KM = 0.4;
export const PENALIZACION_MAX_PTS = 25;

/** Internal sort score. NEVER shown in the UI (the UI always displays the raw score). */
export function scoreAjustado(puntuacion: number, distKm: number): number {
  if (!Number.isFinite(distKm)) return puntuacion;
  return puntuacion - Math.min(distKm * PENALIZACION_PTS_POR_KM, PENALIZACION_MAX_PTS);
}

/** Structural subset of FeaturedBeach — the minimum the ranking needs. */
export interface PlayaRankeable {
  codigo: string;
  nombre: string;
  lat: number;
  lon: number;
  puntuacion: number;
}

function compararDesempate(a: PlayaRankeable, b: PlayaRankeable): number {
  return b.puntuacion - a.puntuacion || a.nombre.localeCompare(b.nombre, 'es');
}

/**
 * Sorts the pool transitively and deterministically. With a location, by
 * distance-adjusted score desc; without it, by raw score desc.
 * Tiebreakers: score desc, then name. Does not mutate the input array.
 */
export function rankearPlayas<T extends PlayaRankeable>(
  pool: T[],
  userLocation: [number, number] | null,
  max = 5
): T[] {
  if (!userLocation) {
    return [...pool].sort(compararDesempate).slice(0, max);
  }
  const [uLat, uLon] = userLocation;
  return pool
    .map((playa) => ({
      playa,
      ajustado: scoreAjustado(playa.puntuacion, haversineKm(uLat, uLon, playa.lat, playa.lon)),
    }))
    .sort((a, b) => b.ajustado - a.ajustado || compararDesempate(a.playa, b.playa))
    .slice(0, max)
    .map((d) => d.playa);
}

/**
 * Code of the displayed (non-hero) beach with the highest raw score, ONLY if
 * it strictly beats the hero; null if the hero already is (or ties with) the
 * maximum. Serves both to enable the hero's "priorizada por cercanía" note
 * and the "mejor puntuación" chip on that alternative.
 */
export function codigoMejorPuntuacionNoHero(ordenadas: PlayaRankeable[]): string | null {
  if (ordenadas.length < 2) return null;
  const hero = ordenadas[0];
  let mejor: PlayaRankeable | null = null;
  for (const playa of ordenadas.slice(1)) {
    if (!mejor || playa.puntuacion > mejor.puntuacion) mejor = playa;
  }
  return mejor && mejor.puntuacion > hero.puntuacion ? mejor.codigo : null;
}

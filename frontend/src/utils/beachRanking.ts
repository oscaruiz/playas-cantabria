/**
 * Ranking de playas destacadas para la Home: combina la puntuación del
 * backend (que no conoce la ubicación del usuario) con la distancia
 * calculada en cliente, mediante una clave de ordenación única y por
 * tanto transitiva (a diferencia del comparador por pares anterior).
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

// Calibración: una playa cercana puede presidir sobre otra con más puntos
// (78@15km gana a 84@33km), pero el tope evita que la distancia domine:
// a partir de 62.5 km todas penalizan igual y decide la puntuación cruda.
export const PENALIZACION_PTS_POR_KM = 0.4;
export const PENALIZACION_MAX_PTS = 25;

/** Score interno de ordenación. NUNCA se muestra en UI (la UI enseña siempre la puntuación cruda). */
export function scoreAjustado(puntuacion: number, distKm: number): number {
  if (!Number.isFinite(distKm)) return puntuacion;
  return puntuacion - Math.min(distKm * PENALIZACION_PTS_POR_KM, PENALIZACION_MAX_PTS);
}

/** Subconjunto estructural de FeaturedBeach — lo mínimo que necesita el ranking. */
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
 * Ordena el pool de forma transitiva y determinista. Con ubicación, por
 * score ajustado por distancia desc; sin ella, por puntuación cruda desc.
 * Desempates: puntuación desc, luego nombre. No muta el array de entrada.
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
 * Código de la playa mostrada (no-hero) con mayor puntuación cruda, SOLO si
 * supera estrictamente a la hero; null si la hero ya es (o empata con) la
 * máxima. Sirve a la vez para activar la nota "priorizada por cercanía" del
 * hero y el chip "mejor puntuación" en esa alternativa.
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

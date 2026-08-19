import { Beach } from '../entities/Beach';

export interface TideReference {
  beach: Beach;
  distanceKm: number;
}

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two points, in km. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * Nearest beach that can actually have its own tide table (has an AEMET
 * sheet), so a beach with no tides of its own can show that neighbour's as a
 * reference. Tide tables are always relative to a reference point anyway —
 * borrowing the closest one is honest, not a workaround: on this coastline
 * the horizontal shift between beaches a few km apart is one or two minutes.
 *
 * `maxKm` is a defensive ceiling, not a tuned threshold: on Cantabria's
 * catalog the farthest match is under 6 km. It exists for future regions
 * with sparser donors, so a beach 80 km from the nearest AEMET sheet gets no
 * reference at all rather than a misleading one.
 */
export function findTideReference(
  target: Beach,
  candidates: readonly Beach[],
  maxKm = 30,
): TideReference | null {
  let best: TideReference | null = null;
  for (const candidate of candidates) {
    if (candidate.id === target.id) continue;
    if (candidate.sinAemet || !candidate.aemetCode) continue;
    const distanceKm = haversineKm(
      target.latitude,
      target.longitude,
      candidate.latitude,
      candidate.longitude,
    );
    if (distanceKm > maxKm) continue;
    if (!best || distanceKm < best.distanceKm) {
      best = { beach: candidate, distanceKm };
    }
  }
  return best;
}

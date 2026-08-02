import { SunshineObservation } from '../entities/Sunshine';

/**
 * Port for sources of observed sunshine by coordinates (today: AEMET's
 * station network).
 *
 * A separate, narrow port on purpose, not another method on `WeatherProvider`:
 * OpenWeather does not publish sunshine and would have no way to implement it.
 */
export interface SunshineProvider {
  /**
   * Stations with sunshine data closest to the point, SORTED by distance.
   * Empty array if the source responded but none is usable. Throws when the
   * source itself is unavailable, so callers with stale data can preserve it.
   *
   * Returns several and not just the best one because for far-away beaches a
   * second witness is needed before trusting it: a stratus layer is seen by
   * several stations, a broken sensor is not.
   */
  getSunshineNear(lat: number, lon: number): Promise<SunshineObservation[]>;
}

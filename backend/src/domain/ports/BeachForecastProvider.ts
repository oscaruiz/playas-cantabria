import { BeachShortForecast } from '../entities/BeachForecast';

/**
 * Port for the short (today/tomorrow) forecast of a beach by its code
 * (today: AEMET OpenData's beach forecast).
 */
export interface BeachForecastProvider {
  getByBeachCode(code: string): Promise<BeachShortForecast>;
}

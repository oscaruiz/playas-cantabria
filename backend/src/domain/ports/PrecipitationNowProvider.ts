import { PrecipitationNow } from '../entities/RainNowcast';

/** Port for sources of current precipitation by coordinates (e.g. Open-Meteo). */
export interface PrecipitationNowProvider {
  getPrecipitationNow(lat: number, lon: number): Promise<PrecipitationNow>;
}

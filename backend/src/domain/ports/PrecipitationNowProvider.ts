import { PrecipitationNow } from '../entities/RainNowcast';

/** Port para fuentes de precipitación actual por coordenadas (p. ej. Open-Meteo). */
export interface PrecipitationNowProvider {
  getPrecipitationNow(lat: number, lon: number): Promise<PrecipitationNow>;
}

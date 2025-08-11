import { BeachDTO } from './BeachDTO';

export interface WeatherDTO {
  source: 'AEMET' | 'OpenWeather';
  timestamp: number;

  temperatureC: number | null;
  description: string | null;
  icon: string | null;

  windSpeedMs: number | null;
  windDirectionDeg: number | null;

  humidityPct: number | null;
  pressureHPa: number | null;
}

export type FlagColorDTO = 'green' | 'yellow' | 'red' | 'black' | 'unknown';

export interface FlagDTO {
  color: FlagColorDTO;
  message?: string;
  timestamp: number;
}

export interface TideEventDTO {
  time: number;
  heightMeters: number | null;
  type: 'HIGH' | 'LOW';
}

export interface TidesDTO {
  events: TideEventDTO[];
  source: string; // 'N/A' | provider name
}

/**
 * Public API shape for details.
 * Route: GET /api/beaches/:id/details
 */
export interface BeachDetailsDTO {
  beach: BeachDTO;
  weather: WeatherDTO | null;
  flag: FlagDTO | null;
  tides: TidesDTO | null;
}

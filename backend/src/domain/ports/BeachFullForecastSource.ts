import { BeachFullForecast, DayTides } from '../entities/BeachForecast';

/**
 * Port for the full multi-day forecast of a beach by its code, with tides
 * (today: the aemet.es beach page).
 */
export interface BeachFullForecastSource {
  getBeachForecast(code: string): Promise<BeachFullForecast>;
  /** Last tides seen for the beach, kept longer than the forecast itself. */
  getCachedTides(code: string): { tides: DayTides[]; tidesSource: string | null } | undefined;
}

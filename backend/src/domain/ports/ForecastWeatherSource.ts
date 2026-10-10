import { Weather } from '../entities/Weather';
import type { HourlyOutlookSlot } from '../entities/RainNowcast';
import type { OwHalf } from '../entities/BeachForecast';

/**
 * Port for the coordinate-based forecast the detail falls back on when AEMET
 * leaves gaps (today: OpenWeather's 5d/3h forecast).
 */
export interface ForecastWeatherSource {
  getTomorrowByCoords(lat: number, lon: number): Promise<Weather>;
  getOutlookSlots(lat: number, lon: number): Promise<HourlyOutlookSlot[]>;
  getCloudinessTodayAndTomorrow(lat: number, lon: number): Promise<{ today: number | null; tomorrow: number | null }>;
  getForecastHalfDays(lat: number, lon: number, days?: number): Promise<Array<{ manana: OwHalf; tarde: OwHalf }>>;
}

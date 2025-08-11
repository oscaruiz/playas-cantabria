export type WeatherSource = 'AEMET' | 'OpenWeather';

export interface Weather {
  source: WeatherSource;
  /** Unix epoch (ms) when the weather data was observed/produced. */
  timestamp: number;

  /** Basic, provider-agnostic fields we expose to the API. */
  temperatureC: number | null;
  description: string | null;
  icon: string | null;

  windSpeedMs: number | null;
  windDirectionDeg: number | null;

  humidityPct: number | null;
  pressureHPa: number | null;
}

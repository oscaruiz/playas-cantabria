export type WeatherSource = 'AEMET' | 'OpenWeather' | 'Open-Meteo';

export interface Weather {
  source: WeatherSource;
  /** Unix epoch (ms) when the weather data was observed/produced. */
  timestamp: number;

  /** Basic, provider-agnostic fields we expose to the API. */
  temperatureC: number | null;
  /** Sky. Null when no provider described it: never made up from other readings. */
  description: string | null;
  icon: string | null;
  /**
   * The sky is AEMET's FORECAST for today, not an observation: what is left
   * when neither OpenWeather nor Open-Meteo answered. Shown labelled as such.
   */
  previsto?: boolean;

  /** Observed precipitation in the last hour (mm). Only set by real-time
   *  current-weather sources (e.g. OpenWeather `rain.1h`). Optional/nullable. */
  precipitationMm?: number | null;

  /** Provider condition code (OpenWeather `weather[0].id`): structured
   *  alternative to `description` (2xx/3xx/5xx = precipitating). Optional. */
  conditionCode?: number | null;

  /** Cloudiness (%) of the current observation. Filled in by OpenWeather
   *  (`clouds.all`); used to estimate UV without spending another call. Optional. */
  cloudinessPct?: number | null;

  windSpeedMs: number | null;
  windDirectionDeg: number | null;

  humidityPct: number | null;
  pressureHPa: number | null;
}

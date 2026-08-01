/**
 * Aggregated "is it raining now?" signal combining several free sources
 * (OpenWeather condition code, AEMET rain gauge, Open-Meteo).
 * The domain uses English values (FlagColor pattern 'green' → DTO 'Verde');
 * the mapping to 'lloviendo'/'sin_lluvia'/'desconocido' lives in the DTO.
 */

export type RainNowcastStatus = 'raining' | 'dry' | 'unknown';

export type RainSourceName = 'OpenWeather' | 'AEMET' | 'OpenMeteo';

export interface RainSourceSignal {
  source: RainSourceName;
  /** This source detects active precipitation. */
  precipitating: boolean;
  precipitationMm: number | null;
  /** true = accumulated over the last hour (AEMET rain gauge): a weaker /
   *  more delayed signal than a current-condition observation. */
  lastHour: boolean;
  /** Unix epoch (ms) of the source's data. */
  timestamp: number;
}

/** A 15-min slot from Open-Meteo's minutely_15 forecast. */
export interface PrecipitationSlot {
  /** Unix epoch (ms) of the slot start (UTC). */
  timestamp: number;
  precipitationMm: number | null;
  /** Forecast WMO code for the slot. */
  weatherCode: number | null;
}

/**
 * One hour of the forecast used to judge whether conditions are ABOUT to get
 * better or worse. It rides on the nowcast's request (same call, no extra
 * quota), which is why it lives next to the precipitation entities and not in
 * a weather module of its own.
 */
export interface HourlyOutlookSlot {
  /** Unix epoch (ms) of the hour start (UTC). */
  timestamp: number;
  cloudCoverPct: number | null;
  temperatureC: number | null;
  /** m/s, requested as such: Open-Meteo defaults to km/h. */
  windSpeedMs: number | null;
}

/** Signal of precipitation forecast for the next few hours (Open-Meteo). */
export interface RainUpcoming {
  expected: boolean;
  /** Unix epoch (ms) of the first slot with precipitation (null if expected=false). */
  firstAt: number | null;
  /** Maximum mm of a slot with precipitation. */
  mmMax: number | null;
}

export interface RainNowcast {
  status: RainNowcastStatus;
  /** Maximum of the mm reported by the sources (null if none reports). */
  precipitationMm: number | null;
  /** true if ONLY the AEMET rain gauge triggered the rain signal. */
  lastHourOnly: boolean;
  /** Only sources that responded (the ones that were down do not appear). */
  sources: RainSourceSignal[];
  /** Unix epoch (ms) of the aggregation. */
  timestamp: number;
  /** Precipitation forecast for the next ~6h (null if Open-Meteo did not respond). */
  upcoming?: RainUpcoming | null;
  /** Max UV today/tomorrow from Open-Meteo (null if it did not respond). */
  uvIndexMax?: UvIndexMax | null;
  /** Hourly sky/temperature/wind forecast, for the score's outlook adjustment. */
  outlook?: HourlyOutlookSlot[] | null;
}

/** Raw current-precipitation observation from Open-Meteo. */
export interface PrecipitationNow {
  source: 'OpenMeteo';
  /** Unix epoch (ms) of the data. */
  timestamp: number;
  /** current.precipitation (mm, sum of rain/showers/snow). */
  precipitationMm: number | null;
  rainMm: number | null;
  showersMm: number | null;
  /** WMO code of the current condition (51-67, 80-82, 95-99 = precipitation). */
  weatherCode: number | null;
  /** 15-min slots for the next ~6h (minutely_15). Empty if the API does not return them. */
  upcomingSlots?: PrecipitationSlot[];
  /** Hourly sky/temperature/wind, same request. Empty if the API omits them. */
  upcomingHours?: HourlyOutlookSlot[];
  /** Forecast max UV for today and tomorrow (`daily.uv_index_max`), in the SAME
   *  request as the precipitation: replaces the dead One Call request. */
  uvIndexMax?: UvIndexMax | null;
}

/** Daily max UV (today / tomorrow). */
export interface UvIndexMax {
  today: number | null;
  tomorrow: number | null;
}

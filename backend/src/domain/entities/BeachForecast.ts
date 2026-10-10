export interface HalfDayForecast {
  skyDescription: string | null;
  skyIconCode: number | null;
  wind: string | null;
  waves: string | null;
}

export interface DayForecast {
  date: string;
  morning: HalfDayForecast;
  afternoon: HalfDayForecast;
  maxTemperatureC: number | null;
  thermalSensation: string | null;
  waterTemperatureC: number | null;
  uvIndexMax: number | null;
  uvLevel: string | null;
  warning: {
    level: number | null;
    description: string | null;
    phenomenon: string | null;
  } | null;
}

export interface DayTides {
  highTide: string[];
  lowTide: string[];
}

export interface BeachFullForecast {
  source: 'AEMET_XML' | 'AEMET_HTML';
  elaboration: string | null;
  warningZone: string | null;
  days: DayForecast[];
  tides: DayTides[];
  tidesSource: string | null;
}

/** One day of the short beach forecast (AEMET OpenData's beach endpoint). */
export type BeachForecastDay = {
  summary: string;
  temperature: number | null;
  waterTemperature: number | null;
  sensation: string | null;
  wind: string;
  waves: string;
  uvIndex: number | null;
  icon: number | null;
};

/** Today/tomorrow forecast served by a `BeachForecastProvider`. */
export type BeachShortForecast = {
  source: 'AEMET';
  lastUpdatedIso: string;
  today: BeachForecastDay;
  tomorrow: BeachForecastDay;
};

/** Half day (morning or afternoon) of the OpenWeather forecast, to fill AEMET gaps. */
export type OwHalf = {
  descripcion: string | null;
  iconOw: string | null;
  vientoMs: number | null;
};

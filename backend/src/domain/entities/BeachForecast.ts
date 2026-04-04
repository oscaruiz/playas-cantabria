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

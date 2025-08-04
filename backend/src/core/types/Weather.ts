export type WeatherSource = 'AEMET' | 'OpenWeatherMap';

export interface DailyForecast {
  summary?: string;          // Estado del cielo
  temperature?: number;      // Temperatura máxima
  waterTemperature?: number; // Temperatura del agua
  sensation?: string;        // Sensación térmica (descripción)
  wind?: string;            // Descripción del viento
  waves?: string;           // Estado del oleaje
  uvIndex?: number;         // Índice UV máximo
  icon?: string;            // Código del icono para el estado del cielo
}

export interface StandardWeather {
  source: WeatherSource;
  lastUpdated: string;
  forecast: {
    today: DailyForecast;
    tomorrow: DailyForecast;
  };
}

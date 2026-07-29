import { SunshineObservation } from '../entities/Sunshine';

/**
 * Port para fuentes de insolación observada por coordenadas (hoy: red de
 * estaciones de AEMET).
 *
 * Puerto aparte y estrecho a propósito, no un método más en `WeatherProvider`:
 * OpenWeather no publica insolación y no tendría cómo implementarlo.
 */
export interface SunshineProvider {
  /**
   * Estaciones con insolación más cercanas al punto, ORDENADAS por distancia.
   * Array vacío si no hay ninguna utilizable. Nunca lanza.
   *
   * Devuelve varias y no solo la mejor porque para las playas lejanas hace falta
   * un segundo testigo antes de fiarse: una capa de estratos la ven varias
   * estaciones, un sensor averiado no.
   */
  getSunshineNear(lat: number, lon: number): Promise<SunshineObservation[]>;
}

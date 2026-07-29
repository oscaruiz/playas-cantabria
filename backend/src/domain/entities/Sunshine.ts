/**
 * Insolación OBSERVADA en una estación: minutos de sol registrados durante la
 * hora anterior.
 *
 * Es la única señal de cielo que tenemos que no sale de un modelo. Los modelos
 * (OpenWeather, Open-Meteo, met.no, la previsión de playas de AEMET) comparten
 * el mismo punto ciego: una capa de estratos marinos pegada a la costa cabe
 * entera dentro de una celda de su rejilla y desaparece. Que varios coincidan
 * en "despejado" no es corroboración, es el mismo error repetido.
 */
export interface SunshineObservation {
  /** Minutos de sol de la última hora, 0-60. */
  insoMin: number;
  /** `insoMin / 60`, precalculado por comodidad de quien decide. */
  fraccion: number;
  /** Distancia de la estación a la playa consultada. */
  distanciaKm: number;
  /** Identificador AEMET de la estación (p. ej. "1111X"). */
  idema: string;
  /** Nombre legible, para el diagnóstico. */
  ubicacion: string | null;
  /** Epoch (ms) de la observación (`fint`), NO de cuándo la descargamos. */
  observadoEn: number;
}

/**
 * Señal agregada de "¿está lloviendo ahora?" combinando varias fuentes
 * gratuitas (OpenWeather condition code, pluviómetro AEMET, Open-Meteo).
 * El dominio usa valores en inglés (patrón FlagColor 'green' → DTO 'Verde');
 * el mapeo a 'lloviendo'/'sin_lluvia'/'desconocido' vive en el DTO.
 */

export type RainNowcastStatus = 'raining' | 'dry' | 'unknown';

export type RainSourceName = 'OpenWeather' | 'AEMET' | 'OpenMeteo';

export interface RainSourceSignal {
  source: RainSourceName;
  /** Esta fuente detecta precipitación activa. */
  precipitating: boolean;
  precipitationMm: number | null;
  /** true = acumulado de la última hora (pluviómetro AEMET): señal más
   *  débil/retardada que una observación de condición actual. */
  lastHour: boolean;
  /** Unix epoch (ms) del dato de la fuente. */
  timestamp: number;
}

/** Un tramo de 15 min de la previsión minutely_15 de Open-Meteo. */
export interface PrecipitationSlot {
  /** Unix epoch (ms) del inicio del tramo (UTC). */
  timestamp: number;
  precipitationMm: number | null;
  /** Código WMO previsto para el tramo. */
  weatherCode: number | null;
}

/** Señal de precipitación prevista en las próximas horas (Open-Meteo). */
export interface RainUpcoming {
  expected: boolean;
  /** Unix epoch (ms) del primer tramo con precipitación (null si expected=false). */
  firstAt: number | null;
  /** Máximo mm de un tramo con precipitación. */
  mmMax: number | null;
}

export interface RainNowcast {
  status: RainNowcastStatus;
  /** Máximo de los mm reportados por las fuentes (null si ninguna reporta). */
  precipitationMm: number | null;
  /** true si SOLO el pluviómetro AEMET disparó la señal de lluvia. */
  lastHourOnly: boolean;
  /** Solo fuentes que respondieron (las caídas no aparecen). */
  sources: RainSourceSignal[];
  /** Unix epoch (ms) de la agregación. */
  timestamp: number;
  /** Previsión de precipitación próximas ~6h (null si Open-Meteo no respondió). */
  upcoming?: RainUpcoming | null;
}

/** Observación cruda de precipitación actual de Open-Meteo. */
export interface PrecipitationNow {
  source: 'OpenMeteo';
  /** Unix epoch (ms) del dato. */
  timestamp: number;
  /** current.precipitation (mm, suma de lluvia/chubascos/nieve). */
  precipitationMm: number | null;
  rainMm: number | null;
  showersMm: number | null;
  /** Código WMO de condición actual (51-67, 80-82, 95-99 = precipitación). */
  weatherCode: number | null;
  /** Tramos de 15 min de las próximas ~6h (minutely_15). Vacío si la API no los trae. */
  upcomingSlots?: PrecipitationSlot[];
}

import { WeatherSource } from '../../domain/entities/Weather';

export interface WeatherDTO {
  source: WeatherSource;
  timestamp: number;
  temperatura: number | null;
  viento: number | null;
  direccionViento: number | null;
  humedad: number | null;
  presion: number | null;
  descripcion: string | null;
  icono: string | null;
}

/**
 * Public API shape for a beach item (Spanish keys preserved).
 * Mirrors data/beaches.json keys with added weather and flag info.
 */
export interface BeachDTO {
  nombre: string;
  municipio: string;
  codigo: string;
  lat: number;
  lon: number;
  idCruzRoja: number;
  clima?: WeatherDTO;
  bandera?: string;
}

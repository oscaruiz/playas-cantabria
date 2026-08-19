import { WeatherSource } from '../../domain/entities/Weather';
import { Webcam, BeachSector } from '../../domain/entities/Beach';

/**
 * Cruz Roja station as published by the API. Part of the public contract:
 * the domain now models stations neutrally (FlagStation), but these keys
 * (`id`, `nombreFuente`) must not change.
 */
export interface CruzRojaStationDTO {
  id?: number;
  nombreFuente: string;
}

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

export interface BeachAttributesDTO {
  accesoBanista?: boolean;
  accesible?: boolean;
  mascotas?: boolean;
  duchas?: boolean;
  aseos?: boolean;
  parking?: boolean;
  chiringuito?: boolean;
  socorrismo?: boolean;
  nudista?: boolean;
  surf?: boolean;
}

/**
 * Public API shape for a beach item (Spanish keys preserved).
 * Mirrors a region's beaches.json keys with added weather and flag info.
 */
export interface BeachDTO {
  nombre: string;
  municipio: string;
  codigo: string;
  lat: number;
  lon: number;
  idCruzRoja: number;
  /** Red Cross stations (0, 1 or several). Present only on multi-station beaches. */
  cruzRojaStations?: CruzRojaStationDTO[];
  /**
   * Public name of the operator watching this beach ("Cruz Roja"), or null if
   * nobody does. Always present so a client can tell "no lifeguard service
   * here" (null) from "an old backend that does not report it" (absent).
   */
  fuenteBanderas: string | null;
  /** Alternative names/toponyms for search. */
  alias?: string[];
  /** Distinct sectors (metadata; lengths are not summed). */
  sectores?: BeachSector[];
  sinAemet?: boolean;
  atributos?: BeachAttributesDTO;
  longitud?: number;
  anchura?: number;
  tipoPlaya?: string;
  arena?: string;
  acceso?: string[];
  parkingDescripcion?: string;
  bus?: string;
  hospitalDistancia?: number;
  submarinismo?: boolean;
  webcam?: Webcam;
  /** Year of the current Blue Flag award; absent if the beach has none. */
  banderaAzul?: number;
  clima?: WeatherDTO;
  bandera?: string;
}

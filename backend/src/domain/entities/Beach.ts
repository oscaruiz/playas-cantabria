import { FlagRef, FlagStation } from './Flag';

export interface BeachAttributes {
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
 * Webcam asociada a una playa. Datos editoriales estáticos (viven en beaches.json).
 * `cobertura` distingue si la cámara enfoca exactamente esta playa, una panorámica
 * compartida por varias, o una playa cercana (nunca se presenta cercana como exacta).
 * Solo se ofrece como ENLACE externo — no se embebe (no se asumen permisos de iframe).
 */
export interface Webcam {
  url: string;
  cobertura: 'exacta' | 'compartida' | 'cercana';
  /** "desactivada" oculta la cámara sin borrar la entrada. Ausente = activa. */
  estado?: 'activa' | 'desactivada';
}

/**
 * Sector diferenciado de una playa (p. ej. Somocuevas Oriental/Occidental,
 * Langre La Grande/La Pequeña). Metadato: NO se suman longitudes entre sectores.
 */
export interface BeachSector {
  nombre: string;
  longitud?: number;
}

export interface Beach {
  /** Internal beach id: we’ll use the AEMET `codigo` from the static JSON. */
  id: string;
  name: string;
  municipality: string;
  aemetCode: string;
  latitude: number;
  longitude: number;
  /**
   * Primary flag reference; absent means "no flag coverage on record".
   * Still the source for single-flag consumers (featured, legacy beaches).
   * On multi-station beaches the repository derives it from the first
   * station with a known ref.
   */
  flagRef?: FlagRef;
  /**
   * Lifeguard stations on this physical beach (0, 1 or several). When present
   * with refs, flags are aggregated conservatively (most restrictive wins).
   * Complements `flagRef` without breaking single-flag consumers.
   */
  flagStations?: FlagStation[];
  /** Nombres alternativos/topónimos/sectores para búsqueda y resolución de nombres. */
  alias?: string[];
  /** Sectores diferenciados (metadato). No se suman longitudes entre sectores. */
  sectores?: BeachSector[];
  /** true si la playa no tiene ficha de previsión en AEMET (solo tiempo actual por coordenadas). */
  sinAemet?: boolean;
  attributes?: BeachAttributes;
  lengthM?: number;
  widthM?: number;
  beachType?: string;
  sandType?: string;
  access?: string[];
  parkingDescription?: string;
  busInfo?: string;
  hospitalDistanceKm?: number;
  diving?: boolean;
  webcam?: Webcam;
}

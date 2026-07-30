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
 * Webcam associated with a beach. Static editorial data (lives in beaches.json).
 * `cobertura` distinguishes whether the camera points exactly at this beach, at a
 * panorama shared by several, or at a nearby beach (a nearby one is never
 * presented as exact). Offered only as an external LINK — never embedded (iframe
 * permissions are not assumed).
 */
export interface Webcam {
  url: string;
  cobertura: 'exacta' | 'compartida' | 'cercana';
  /** "desactivada" hides the camera without deleting the entry. Absent = active. */
  estado?: 'activa' | 'desactivada';
}

/**
 * Distinct sector of a beach (e.g. Somocuevas Oriental/Occidental,
 * Langre La Grande/La Pequeña). Metadata: lengths are NOT summed across sectors.
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
  /** Alternative names/toponyms/sectors for search and name resolution. */
  alias?: string[];
  /** Distinct sectors (metadata). Lengths are not summed across sectors. */
  sectores?: BeachSector[];
  /** true if the beach has no AEMET forecast page (only current weather by coordinates). */
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

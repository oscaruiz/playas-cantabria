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
 * Un puesto de Cruz Roja. Una playa física puede tener 0, 1 o varios puestos
 * (p. ej. Berria, Trengandín, Loredo). Cada puesto conserva su nombre e id de
 * origen para resolverlo hacia su playa canónica y agregar sus banderas.
 */
export interface CruzRojaStation {
  /** Id del puesto en Cruz Roja. Ausente/undefined = id no verificado todavía. */
  id?: number;
  /** Nombre del puesto tal cual aparece en Cruz Roja (alias operativo). */
  nombreFuente: string;
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
   * Red Cross beach id; 0 or undefined means “no Red Cross record”.
   * Sigue siendo la fuente para las 20 playas legadas y para consumidores de una
   * sola bandera (featured). En playas con varios puestos, el repositorio lo
   * deriva del primer puesto con id conocido.
   */
  redCrossId?: number;
  /**
   * Puestos de Cruz Roja de esta playa física (0, 1 o varios). Cuando existe y
   * trae ids, las banderas se agregan con una regla conservadora (la más
   * restrictiva). Complementa `redCrossId` sin romper compatibilidad.
   */
  cruzRojaStations?: CruzRojaStation[];
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

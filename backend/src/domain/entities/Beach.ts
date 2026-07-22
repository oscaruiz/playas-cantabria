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

export interface Beach {
  /** Internal beach id: we’ll use the AEMET `codigo` from the static JSON. */
  id: string;
  name: string;
  municipality: string;
  aemetCode: string;
  latitude: number;
  longitude: number;
  /** Red Cross beach id; 0 or undefined means “no Red Cross record”. */
  redCrossId?: number;
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

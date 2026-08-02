import { BeachAttributesDTO } from './BeachDTO';

/**
 * Points this beach scored on each factor, BEFORE the caps and the outlook
 * adjustment. Published so the app can answer "why does this beach have 59?"
 * instead of explaining the model in the abstract.
 */
export interface SubPuntuacionesDTO {
  cielo: number;
  temperatura: number;
  bandera: number;
  viento: number;
  oleaje: number;
  datos: number;
}

/** Where conditions are heading in the next few hours, and what it is worth. */
export interface PronosticoDTO {
  direccion: 'mejora' | 'empeora' | 'estable';
  /** Points added (or subtracted) by the outlook. */
  delta: number;
  /**
   * WHY it is moving: the dominant factor, so the app can say "mejora, se
   * despeja" instead of an unactionable "mejora". A structured value and not a
   * phrase because the client already translates it from a key — unlike
   * `razonRanking`, which travels as Spanish text.
   *
   * `lluvia_prevista` does not come from the delta (rain scores through the
   * caps, not the outlook): it is the reason that most changes the plan, so it
   * takes precedence over the other factors. Null when there is nothing worth
   * naming, and absent from older cached responses.
   */
  causa:
    | 'despeja'
    | 'nubla'
    | 'sube_temperatura'
    | 'baja_temperatura'
    | 'amaina_viento'
    | 'arrecia_viento'
    | 'lluvia_prevista'
    | null;
}

/** Cap that clipped the score, and therefore why the factors do not add up. */
export type TopeDTO = 'lluvia' | 'lluvia_prevista';

export interface FeaturedBeachDTO {
  nombre: string;
  municipio: string;
  codigo: string;
  lat: number;
  lon: number;
  temperatura: number | null;
  descripcionClima: string | null;
  iconoClima: string | null;
  vientoMs: number | null;
  bandera: 'Verde' | 'Amarilla' | 'Roja' | null;
  puntuacion: number;
  razonRanking: string;
  motivoBaja: string | null;
  atributos: BeachAttributesDTO | null;
  /** Additive block: score breakdown and where the day is going. */
  subpuntuaciones: SubPuntuacionesDTO | null;
  pronostico: PronosticoDTO | null;
  topeAplicado: TopeDTO | null;
  /** Sea state as AEMET words it: the value shown next to the waves factor. */
  oleaje: string | null;
}

export interface FeaturedBeachesResponseDTO {
  timestamp: number;
  playas: FeaturedBeachDTO[];
  revisar: FeaturedBeachDTO[];
  resumenTodas: FeaturedBeachDTO[];
  /**
   * Reachable maximum of each factor, sent ONCE for the whole response instead
   * of repeated per beach: it is the same scale for every one of them, and it
   * has to travel so the bar cannot drift from the weights it is drawing.
   */
  maximos: SubPuntuacionesDTO;
}

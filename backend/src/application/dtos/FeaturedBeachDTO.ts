import { BeachAttributesDTO } from './BeachDTO';
import type { LluviaDTO } from '../mappers/LegacyDetailsMapper';

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

/**
 * Best stretch of the remaining beach window, plus the first turn for the
 * worse after it. Instants travel as ISO strings and the cause as a key (the
 * same vocabulary as `PronosticoDTO.causa`): the client composes and
 * translates "Mejor momento: 11:00–14:00 · a partir de las 17:00 aumenta el
 * viento" — an hour baked into a Spanish phrase here could not be translated.
 */
export interface VentanaDiaDTO {
  inicio: string;
  fin: string;
  cambio: { desde: string; causa: PronosticoDTO['causa'] } | null;
}

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
  /** WHEN to go today. Null outside the beach window, with the hourly source
   *  down, or when no stretch is good enough to recommend. */
  ventanaDia: VentanaDiaDTO | null;
  /** Sea state as AEMET words it: the value shown next to the waves factor. */
  oleaje: string | null;
  /**
   * Live rain signal — the same aggregated nowcast the detail publishes in
   * `tiempoActual.lluvia`. It has to travel here too: OpenWeather's current
   * description says "nubes" during drizzle, so without this field the map
   * cannot know it is raining while the detail says so. Additive field; null
   * when the nowcast did not respond (older cached responses lack it).
   */
  lluvia: LluviaDTO | null;
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

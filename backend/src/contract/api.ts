/**
 * PUBLIC API CONTRACT — the JSON shapes this backend sends to clients.
 *
 * Single source of truth for both packages: the frontend gets a generated
 * copy in `frontend/src/contract/` (`npm run sync-contract` there; CI fails if
 * it drifts). Rules:
 *   - Pure types only, and no imports: the file must compile on both sides.
 *   - Keys are Spanish and public. Never rename or remove one; add fields as
 *     optional so older clients and cached responses keep working.
 *   - The mappers return these types, so tsc checks the domain against them.
 */

// ---------------------------------------------------------------------------
// GET /api/:region/beaches and /beaches/:id
// ---------------------------------------------------------------------------

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
  source: 'AEMET' | 'OpenWeather' | 'Open-Meteo';
  timestamp: number;
  temperatura: number | null;
  viento: number | null;
  direccionViento: number | null;
  humedad: number | null;
  presion: number | null;
  descripcion: string | null;
  icono: string | null;
}

export type BeachAttributesDTO = {
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
};

/** Beach webcam: an external link only, never embedded. */
export interface WebcamDTO {
  url: string;
  cobertura: 'exacta' | 'compartida' | 'cercana';
  /** "desactivada" hides the camera without deleting the entry. Absent = active. */
  estado?: 'activa' | 'desactivada';
}

/** Distinct sector of a beach. Metadata: lengths are NOT summed across sectors. */
export interface BeachSectorDTO {
  nombre: string;
  longitud?: number;
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
  sectores?: BeachSectorDTO[];
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
  webcam?: WebcamDTO;
  /** Year of the current Blue Flag award; absent if the beach has none. */
  banderaAzul?: number;
  clima?: WeatherDTO;
  bandera?: string;
}

// ---------------------------------------------------------------------------
// GET /api/:region/beaches/:id/details
// ---------------------------------------------------------------------------

/**
 * A value of the day that nobody measured and no model forecast: this backend
 * DERIVED it from another value (waves from wind, thermal sensation from
 * temperature, UV from cloudiness) or filled it with a default (water).
 *
 * It travels because the client cannot tell the difference by looking at the
 * number, and showing a derived value as if it were an observation is the one
 * thing a beach app must not do.
 */
export type CampoEstimado = 'sensacion' | 'viento' | 'oleaje' | 'uv' | 'agua';

export type ClimaDiaDTO = {
  summary: string | null;
  temperature: number | null;
  waterTemperature: number | null;
  sensation: string | null;
  wind: string | null;
  waves: string | null;
  uvIndex: number | null;
  icon: number | null;
  /** Fields of this day that were derived, not observed or forecast. */
  estimados?: CampoEstimado[];
};

export type ClimaDTO = {
  fuente: 'AEMET' | 'OpenWeather' | 'Open-Meteo';
  ultimaActualizacion: string;
  hoy: ClimaDiaDTO;
  manana: ClimaDiaDTO | null;
};

/**
 * Real-time observation ("now") for TODAY. Separate from `clima`/`prediccionCompleta`
 * (which are AEMET FORECAST): this block reflects the actual current state of the sky,
 * temperature and precipitation, taking priority over the forecast in the summary card.
 */
/**
 * Aggregated "is it raining now?" signal (multi-source: OpenWeather,
 * AEMET rain gauge, Open-Meteo). Additive field inside `tiempoActual`.
 */
/** FORECAST rain (next ~6h from Open-Meteo ∪ remaining AEMET text for today). */
export type LluviaPrevistaDTO = {
  /** ISO of the first 15-min slot with precipitation; null if the signal is text-only (AEMET). */
  desdeIso: string | null;
  /** Maximum mm per forecast slot. */
  mm: number | null;
  fuentes: string[];
};

export type LluviaDTO = {
  estado: 'lloviendo' | 'sin_lluvia' | 'desconocido';
  mm: number | null;
  /** true = only the AEMET rain gauge triggered the signal (it rained in the last hour). */
  ultimaHora: boolean;
  fuentes: string[];
  timestamp: string;
  prevista?: LluviaPrevistaDTO | null;
};

/**
 * One hour of the forecast that the score's outlook is judging. Published so
 * the interface can show WHAT is coming, not just the verdict: "improving" is
 * worth a lot more next to the hours that back it.
 */
export type PrevisionHoraDTO = {
  horaIso: string;
  nubesPct: number | null;
  temperaturaC: number | null;
  vientoMs: number | null;
  /** Forecast rain for this hour (additive): lets the strip mark wet hours. */
  precipitacionMm?: number | null;
};

export type TiempoActualDTO = {
  cielo: string | null;
  icono: number | null;
  temperatura: number | null;
  precipitacionMm: number | null;
  /**
   * Who described the sky now. 'Open-Meteo' stands in when OpenWeather has
   * nothing; 'AEMET' is a station reading whose sky, if any, is the FORECAST
   * (see `previsto`). `cielo` null means nobody described it.
   */
  fuente: 'OpenWeather' | 'AEMET' | 'Open-Meteo';
  /** `cielo` is AEMET's forecast for today, not an observation: label it so. */
  previsto?: boolean;
  timestamp: string;
  lluvia?: LluviaDTO | null;
  /** Next few hours, already trimmed to the beach window. Additive field. */
  previsionHoras?: PrevisionHoraDTO[] | null;
  /**
   * Who forecast those hours. It travels instead of being written into the
   * interface because the app must never claim a provider it is not using:
   * the day this falls back to another source, the label follows on its own.
   */
  previsionHorasFuente?: string | null;
  /**
   * WHEN to go today: best stretch of the remaining beach window plus the
   * first turn for the worse after it. Same shape as the featured listing's
   * field, so both screens compose the same sentence. Additive field.
   */
  ventanaDia?: VentanaDiaDTO | null;
  /** Who forecast the window's hours — same reason as `previsionHorasFuente`. */
  ventanaDiaFuente?: string | null;
  /**
   * Whether the provider considers this observation to be at NIGHT. It is the
   * provider's own day/night call (the `d`/`n` suffix on its icon), which
   * accounts for the real sunrise and sunset at these coordinates — far better
   * than the client guessing from an hour threshold that would be wrong for
   * half the year. `iconToLegacy` collapses both suffixes into one number, so
   * without this the detail could not tell 3 a.m. from midday.
   */
  esNoche?: boolean;
};

export type CruzRojaDTO = {
  bandera: 'Verde' | 'Amarilla' | 'Roja' | 'Negra' | 'Desconocida';
  coberturaDesde?: string | null;
  coberturaHasta?: string | null;
  horario?: string | null;
  ultimaActualizacion: string;
};

export type PrediccionCompletaDTO = {
  fuente: 'AEMET_XML' | 'AEMET_HTML';
  elaboracion: string | null;
  zonaAvisos: string | null;
  dias: Array<{
    fecha: string;
    manana: { cielo: string | null; iconoCielo: number | null; viento: string | null; oleaje: string | null };
    tarde: { cielo: string | null; iconoCielo: number | null; viento: string | null; oleaje: string | null };
    temperaturaMaxima: number | null;
    sensacionTermica: string | null;
    temperaturaAgua: number | null;
    indiceUV: number | null;
    nivelUV: string | null;
    aviso: { nivel: number | null; descripcion: string | null } | null;
  }>;
  mareas: Array<{ pleamar: string[]; bajamar: string[] }>;
  fuenteMareas: string | null;
};

/**
 * Tide table borrowed from the nearest beach that has one, for a beach with
 * no AEMET sheet of its own. Kept OUTSIDE `prediccionCompleta` on purpose:
 * that object labels the whole forecast column as AEMET's, and is nulled out
 * when empty precisely so a beach without a sheet does not misrepresent its
 * source (see the assembler's guard). This field says plainly whose tides
 * these are and how far away.
 */
export type MareaReferenciaDTO = {
  playa: string;
  municipio: string;
  distanciaKm: number;
  mareas: Array<{ pleamar: string[]; bajamar: string[] }>;
  fuenteMareas: string | null;
};

export type DetailsDTO = {
  nombre: string;
  municipio: string;
  codigo: string;
  lat: number;
  lon: number;
  atributos: BeachAttributesDTO | null;
  longitud: number | null;
  anchura: number | null;
  tipoPlaya: string | null;
  arena: string | null;
  acceso: string[] | null;
  parkingDescripcion: string | null;
  bus: string | null;
  hospitalDistancia: number | null;
  submarinismo: boolean | null;
  webcam: WebcamDTO | null;
  /** Year of the current Blue Flag award, or null if the beach has none. */
  banderaAzul: number | null;
  temperaturaActual: number | null;
  tiempoActual: TiempoActualDTO | null;
  clima: ClimaDTO | null;
  /**
   * Operator watching this beach, or null if nobody does. Together with
   * `cruzRoja` it separates the three states the client has to show:
   *   name + data → the flag currently flying
   *   name + null → watched, but no reading right now
   *   null        → no lifeguard flag service here (hide the section)
   */
  fuenteBanderas: string | null;
  cruzRoja: CruzRojaDTO | null;
  prediccionCompleta: PrediccionCompletaDTO | null;
  /** Reference tide from the nearest beach, when this one has none of its own. */
  mareaReferencia: MareaReferenciaDTO | null;
  /**
   * When this payload was actually ASSEMBLED, not when it was served. The
   * details endpoint answers from a stale-while-revalidate cache, so a
   * response can be minutes or hours older than the request that got it — and
   * only this field lets the client say so instead of implying "just now".
   */
  generadoEn?: string;
  /**
   * When the ranking this detail's current conditions were taken from was
   * assembled (its `timestamp`), or null when the detail computed them itself
   * because there was no ranking yet. Equal to the ranking the client paints
   * means the card and the detail are the same picture; different means one
   * of the two has to be fetched again.
   */
  rankingGeneradoEn?: string | null;
};

// ---------------------------------------------------------------------------
// GET /api/:region/beaches/featured
// ---------------------------------------------------------------------------

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
  /**
   * Why this stretch beats the hours it rejected (additive): `sin_lluvia`,
   * or the improving-`causa` vocabulary (`despeja`, `sube_temperatura`,
   * `amaina_viento`). Null when it covers the whole remaining window or no
   * factor stands out — absent on cached responses from older backends.
   */
  motivo?: 'sin_lluvia' | 'despeja' | 'sube_temperatura' | 'amaina_viento' | null;
  /** Forecast hours the verdict is built on — the honest depth (additive). */
  horasConsideradas?: number;
}

export interface FeaturedBeachDTO {
  nombre: string;
  municipio: string;
  codigo: string;
  lat: number;
  lon: number;
  temperatura: number | null;
  descripcionClima: string | null;
  /** `descripcionClima` is a forecast (AEMET), not the sky observed now. */
  climaPrevisto?: boolean;
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
  /** The cap value behind `topeAplicado`; null when no cap clipped the score. */
  topeValor: number | null;
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
  /** When the ranking was ASSEMBLED. See `servidoEn` for the other instant. */
  timestamp: number;
  /**
   * When THIS response was built, which is not the same thing and is why both
   * travel.
   *
   * The same assembled ranking can go out many times from the stale cache, and
   * each time the flags are judged again against the clock — a green that was
   * current at 10:00 is published as no flag at all by 19:00. So two responses
   * can share a `timestamp` and still disagree, and a client holding both needs
   * to know which one asked the question later. Without it, the older reading
   * could overwrite the newer one and put a lifeguard flag back on a beach
   * whose reading had already expired.
   *
   * Additive: an older client ignores it and is no worse off than before.
   */
  servidoEn: number;
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

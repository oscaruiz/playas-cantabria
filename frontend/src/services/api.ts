import { buildRegionApiUrl } from '../config/api';

const PLAYAS_FALLBACK_TIMEOUT_MS = 2500;
const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;

const CLAVE_PLAYAS_GUARDADAS = 'playas:ultimoListado';
/** After a day, the saved copy stops being better than the build's JSON. */
const EDAD_MAXIMA_GUARDADAS_MS = 24 * 60 * 60 * 1000;

let fallbackPromise: Promise<Playa[]> | null = null;
let playasRequest: Promise<Playa[]> | null = null;
let playasCache: { value: Playa[]; expiresAt: number } | null = null;

/**
 * Saves the last REAL listing from the backend. `data/beaches.json` is a snapshot
 * from build time, so a backend response from yesterday is always a better
 * fallback than that copy. Writing to localStorage can fail (private mode,
 * quota full): it must never break the request.
 */
function guardarPlayas(data: Playa[]): void {
  if (data.length === 0) return;
  try {
    localStorage.setItem(
      CLAVE_PLAYAS_GUARDADAS,
      JSON.stringify({ guardadoEn: Date.now(), playas: data }),
    );
  } catch {
    // no persistence: the build's JSON will keep being used
  }
}

function leerPlayasGuardadas(): Playa[] | null {
  try {
    const crudo = localStorage.getItem(CLAVE_PLAYAS_GUARDADAS);
    if (!crudo) return null;
    const parsed = JSON.parse(crudo) as { guardadoEn?: number; playas?: unknown };
    if (!Array.isArray(parsed.playas) || parsed.playas.length === 0) return null;
    if (typeof parsed.guardadoEn !== 'number') return null;
    if (Date.now() - parsed.guardadoEn > EDAD_MAXIMA_GUARDADAS_MS) return null;
    return parsed.playas as Playa[];
  } catch {
    return null;
  }
}

function loadFallbackPlayas(): Promise<Playa[]> {
  const guardadas = leerPlayasGuardadas();
  if (guardadas) return Promise.resolve(guardadas);

  fallbackPromise ??= import('../data/beaches.json').then(
    (module) => module.default as Playa[],
  );
  return fallbackPromise;
}

function fetchPlayasOnce(): Promise<Playa[]> {
  if (playasCache && playasCache.expiresAt > Date.now()) {
    return Promise.resolve(playasCache.value);
  }
  if (playasRequest) return playasRequest;

  playasRequest = fetch(buildRegionApiUrl('/beaches'))
    .then((res) => {
      if (!res.ok) throw new Error('Error al obtener playas');
      return res.json() as Promise<Playa[]>;
    })
    .then((data) => {
      playasCache = { value: data, expiresAt: Date.now() + CLIENT_CACHE_TTL_MS };
      guardarPlayas(data);
      return data;
    })
    .finally(() => {
      playasRequest = null;
    });

  return playasRequest;
}

type GetPlayasOptions = {
  timeoutMs?: number;
  onBackendData?: (data: Playa[]) => void;
  /**
   * Called (at most once) when the local data is returned instead of the
   * backend's, so the user can be warned that it is not fresh.
   *
   * There are two paths and only one recovers: if the timeout fired, the backend
   * may still arrive and trigger `onBackendData`; if the request failed, it
   * will never arrive.
   */
  onFallback?: () => void;
  /**
   * Called if the local copy cannot be loaded either. `getPlayas` keeps its
   * contract of not rejecting and returns [], but the UI can distinguish this
   * failure from a legitimately empty search.
   */
  onFallbackUnavailable?: () => void;
};

export async function getPlayas(options: GetPlayasOptions = {}): Promise<Playa[]> {
  const {
    timeoutMs = PLAYAS_FALLBACK_TIMEOUT_MS,
    onBackendData,
    onFallback,
    onFallbackUnavailable,
  } = options;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let didReturnFallback = false;
  let didReportFallbackUnavailable = false;

  const loadFallbackOrEmpty = async (): Promise<Playa[]> => {
    try {
      return await loadFallbackPlayas();
    } catch {
      if (!didReportFallbackUnavailable) {
        didReportFallbackUnavailable = true;
        onFallbackUnavailable?.();
      }
      return [];
    }
  };

  const fetchPromise = fetchPlayasOnce()
    .then((data) => {
      if (didReturnFallback) {
        onBackendData?.(data);
      }
      return data;
    });

  const timeoutPromise = new Promise<Playa[]>((resolve) => {
    timeoutId = setTimeout(() => {
      didReturnFallback = true;
      onFallback?.();
      // The second argument prevents a failure loading the JSON from leaving this
      // promise hanging forever (infinite spinner): getPlayas resolves
      // ALWAYS, which is the contract the three pages depend on.
      loadFallbackOrEmpty().then(resolve);
    }, timeoutMs);
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch {
    if (!didReturnFallback) {
      didReturnFallback = true;
      onFallback?.();
    }
    return loadFallbackOrEmpty();
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

// ------------------------------
// Base models
// ------------------------------
export interface PlayaAtributos {
  [key: string]: boolean | undefined;
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

export interface CruzRojaStation {
  id?: number;
  nombreFuente: string;
}

export interface BeachSector {
  nombre: string;
  longitud?: number;
}

export interface Playa {
  nombre: string;
  municipio: string;
  codigo: string;
  lat: number;
  lon: number;
  idCruzRoja?: number;
  cruzRojaStations?: CruzRojaStation[];
  /**
   * Operator watching the beach ("Cruz Roja"), null if nobody does. Optional
   * because the local fallback catalog and older backends do not carry it —
   * resolve it with `operadorVigilancia`, never read it raw.
   */
  fuenteBanderas?: string | null;
  alias?: string[];
  sectores?: BeachSector[];
  atributos?: PlayaAtributos;
  longitud?: number;
  anchura?: number;
  tipoPlaya?: string;
  arena?: string;
  acceso?: string[];
  parkingDescripcion?: string;
  bus?: string;
  hospitalDistancia?: number;
  submarinismo?: boolean;
  webcam?: WebcamPlaya | null;
}

// ------------------------------
// Cruz Roja data
// ------------------------------
export interface DatosCruzRoja {
  bandera?: string;
  coberturaDesde?: string;
  coberturaHasta?: string;
  horario?: string;
  ultimaActualizacion?: string;
}

// ------------------------------
// AEMET forecast
// ------------------------------
export interface PrediccionAEMETDia {
  estadoCielo: {
    descripcion1: string;
    descripcion2?: string;
  };
  viento: {
    descripcion1: string;
    descripcion2?: string;
  };
  oleaje: {
    descripcion1: string;
    descripcion2?: string;
  };
  tagua: {
    valor1: number;
  };
  tmaxima: {
    valor1: number;
  };
  stermica: {
    descripcion1: string;
  };
  uvMax: {
    valor1: number;
  };
  fecha: number;
}

export interface DatosAEMET {
  elaborado: string;
  prediccion: {
    dia: PrediccionAEMETDia[];
  };
  origen: {
    productor: string;
    web: string;
    notaLegal?: string;
  };
}

// ------------------------------
// Weather forecast
// ------------------------------
export interface PrediccionDia {
  summary: string;
  temperature: number;
  waterTemperature: number;
  sensation: string;
  wind: string;
  waves: string;
  uvIndex?: number;
  icon: string;
}

export interface DatosClima {
  fuente: 'AEMET' | 'OpenWeatherMap';
  ultimaActualizacion: string;
  hoy: PrediccionDia;
  manana: PrediccionDia;
}

// ------------------------------
// Full forecast (AEMET web scraper)
// ------------------------------
export interface HalfDayDTO {
  cielo: string | null;
  iconoCielo: number | null;
  viento: string | null;
  oleaje: string | null;
}

export interface DiaPrediccionDTO {
  fecha: string;
  manana: HalfDayDTO;
  tarde: HalfDayDTO;
  temperaturaMaxima: number | null;
  sensacionTermica: string | null;
  temperaturaAgua: number | null;
  indiceUV: number | null;
  nivelUV: string | null;
  aviso: { nivel: number | null; descripcion: string | null } | null;
}

export interface PrediccionCompletaDTO {
  fuente: 'AEMET_XML' | 'AEMET_HTML';
  elaboracion: string | null;
  zonaAvisos: string | null;
  dias: DiaPrediccionDTO[];
  mareas: Array<{ pleamar: string[]; bajamar: string[] }>;
  fuenteMareas: string | null;
}

// ------------------------------
// Real-time "now" weather (observation, with priority over the forecast)
// ------------------------------
/**
 * Aggregated "is it raining now?" signal (multi-source in the backend:
 * OpenWeather + AEMET rain gauge + Open-Meteo). Additive field.
 */
/** FORECAST rain (next ~6h Open-Meteo ∪ AEMET text for the rest of today). */
export interface LluviaPrevista {
  /** ISO of the first interval with precipitation; null if the signal is textual only (AEMET). */
  desdeIso: string | null;
  mm: number | null;
  fuentes: string[];
}

export interface LluviaActual {
  estado: 'lloviendo' | 'sin_lluvia' | 'desconocido';
  mm: number | null;
  /** true = only the AEMET rain gauge triggered the signal (it rained in the last hour). */
  ultimaHora: boolean;
  fuentes: string[];
  timestamp: string;
  prevista?: LluviaPrevista | null;
}

/** One hour of the outlook the score is judging (already trimmed by the backend). */
export interface PrevisionHora {
  horaIso: string;
  nubesPct: number | null;
  temperaturaC: number | null;
  vientoMs: number | null;
}

export interface TiempoActual {
  cielo: string | null;
  icono: number | null;
  temperatura: number | null;
  precipitacionMm: number | null;
  fuente: string;
  timestamp: string;
  lluvia?: LluviaActual | null;
  /** Next few hours. Absent when Open-Meteo is down or outside the beach window. */
  previsionHoras?: PrevisionHora[] | null;
  /** Who forecast those hours, as the API credits it. */
  previsionHorasFuente?: string | null;
}

// ------------------------------
// Beach detail
// ------------------------------

/**
 * A beach's webcam (static editorial data). `cobertura` distinguishes whether it points
 * exactly at this beach, at a shared panorama, or at a nearby beach. It is only
 * offered as an external link (not embedded).
 */
export interface WebcamPlaya {
  url: string;
  cobertura: 'exacta' | 'compartida' | 'cercana';
  estado?: 'activa' | 'desactivada';
}

export interface PlayaDetalle {
  nombre: string;
  municipio: string;
  codigo: string;
  lat?: number;
  lon?: number;
  atributos?: PlayaAtributos;
  longitud?: number | null;
  anchura?: number | null;
  tipoPlaya?: string | null;
  arena?: string | null;
  acceso?: string[] | null;
  parkingDescripcion?: string | null;
  bus?: string | null;
  hospitalDistancia?: number | null;
  submarinismo?: boolean | null;
  temperaturaActual?: number | null;

  // Real-time observation for TODAY (actual sky/temp/rain)
  tiempoActual?: TiempoActual | null;

  // Standardized weather data
  clima?: DatosClima;

  // Operator watching the beach; null = no lifeguard flag service here.
  fuenteBanderas?: string | null;

  // May be absent
  cruzRoja?: DatosCruzRoja;

  // Enriched forecast (3 days, tides, warnings)
  prediccionCompleta?: PrediccionCompletaDTO;

  // Beach webcam (may be absent). External link only.
  webcam?: WebcamPlaya | null;
}

/**
 * Why the detail could not be loaded. It exists because the same sentence was
 * shown for a dead backend, a 429, an expired dev IP and a stale service
 * worker — and each of those cost a diagnosis from scratch. The cause is not
 * decoration: it is the first thing anyone needs.
 */
export class ErrorDetalle extends Error {
  /** `null` = the request never came back (network, CORS, service worker). */
  constructor(readonly status: number | null, readonly url: string) {
    super('No se pudo cargar el detalle de la playa');
    this.name = 'ErrorDetalle';
  }
}

export async function getDetallePlaya(codigo: string): Promise<PlayaDetalle> {
  const url = buildRegionApiUrl(`/beaches/${codigo}/details`);

  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    // A rejected fetch has no status: the request never made it back. Network
    // down, CORS, or something intercepting it (a service worker, a proxy).
    const detalle = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error(`[detalle] sin respuesta de ${url}: ${detalle}`);
    throw new ErrorDetalle(null, url);
  }

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error(`[detalle] ${url} respondió ${res.status}`);
    throw new ErrorDetalle(res.status, url);
  }

  return res.json();
}

// ------------------------------
// Featured beaches
// ------------------------------
export interface FeaturedBeach {
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
  atributos: Record<string, boolean> | null;
  /**
   * Score breakdown and outlook. Optional in the type, not in the API: an
   * installed app talking to an older backend simply shows no breakdown.
   */
  subpuntuaciones?: SubPuntuaciones | null;
  pronostico?: Pronostico | null;
  topeAplicado?: 'lluvia' | 'lluvia_prevista' | null;
  oleaje?: string | null;
}

/**
 * Points scored on each factor, before caps and outlook. There is no UV factor:
 * a high index is a reason to bring sunscreen, not to rate the beach worse.
 */
export interface SubPuntuaciones {
  cielo: number;
  temperatura: number;
  bandera: number;
  viento: number;
  oleaje: number;
  datos: number;
}

/**
 * Where the next few hours are heading. `causa` says WHY, as a key and not as
 * text: unlike `razonRanking`, it does not go through `traducirTextoApi`.
 *
 * Optional because a backend that predates it (or a response still in cache
 * from one) simply does not send it — the chip then shows the direction alone.
 */
export interface Pronostico {
  direccion: 'mejora' | 'empeora' | 'estable';
  delta: number;
  causa?: CausaPronostico | null;
}

export type CausaPronostico =
  | 'despeja'
  | 'nubla'
  | 'sube_temperatura'
  | 'baja_temperatura'
  | 'amaina_viento'
  | 'arrecia_viento'
  | 'lluvia_prevista';

export interface FeaturedBeachesResponse {
  timestamp: number;
  playas: FeaturedBeach[];
  revisar: FeaturedBeach[];
  resumenTodas: FeaturedBeach[];
  /** Reachable maximum of each factor, so the bars cannot drift from the model. */
  maximos?: SubPuntuaciones | null;
}

let featuredRequest: Promise<FeaturedBeachesResponse> | null = null;
let featuredCache: { value: FeaturedBeachesResponse; expiresAt: number } | null = null;

export async function getFeaturedBeaches(
  options: { force?: boolean } = {},
): Promise<FeaturedBeachesResponse> {
  if (!options.force && featuredCache && featuredCache.expiresAt > Date.now()) {
    return featuredCache.value;
  }
  if (featuredRequest) return featuredRequest;

  featuredRequest = fetch(buildRegionApiUrl('/beaches/featured'))
    .then((res) => {
      if (!res.ok) throw new Error('No se pudieron cargar las playas destacadas');
      return res.json() as Promise<FeaturedBeachesResponse>;
    })
    .then((value) => {
      featuredCache = { value, expiresAt: Date.now() + CLIENT_CACHE_TTL_MS };
      return value;
    })
    .finally(() => {
      featuredRequest = null;
    });

  return featuredRequest;
}

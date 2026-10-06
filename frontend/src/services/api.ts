import { buildRegionApiUrl } from '../shared/config/api';

const BEACHES_FALLBACK_TIMEOUT_MS = 2500;
/** The catalog: names, coordinates and services. It does not change during a visit. */
const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;
/**
 * The ranking DOES change, and it is the sky the home page shows. It is kept
 * on the same 60 s window the backend gives to `/featured` and `/details`: the
 * bug this closes was the home page showing the sky from ten minutes earlier
 * (5 min of backend cache plus 5 min of this one) while the detail of the same
 * beach, one tap later, showed the current one.
 */
const FEATURED_CACHE_TTL_MS = 60 * 1000;

const SAVED_BEACHES_KEY = 'playas:ultimoListado';
/** After a day, the saved copy stops being better than the build's JSON. */
const MAX_SAVED_AGE_MS = 24 * 60 * 60 * 1000;

let fallbackPromise: Promise<Beach[]> | null = null;
let beachesRequest: Promise<Beach[]> | null = null;
let beachesCache: { value: Beach[]; expiresAt: number } | null = null;

/**
 * Saves the last REAL listing from the backend. `data/beaches.json` is a snapshot
 * from build time, so a backend response from yesterday is always a better
 * fallback than that copy. Writing to localStorage can fail (private mode,
 * quota full): it must never break the request.
 */
function saveBeaches(data: Beach[]): void {
  if (data.length === 0) return;
  try {
    localStorage.setItem(
      SAVED_BEACHES_KEY,
      JSON.stringify({ guardadoEn: Date.now(), playas: data }),
    );
  } catch {
    // no persistence: the build's JSON will keep being used
  }
}

function readSavedBeaches(): Beach[] | null {
  try {
    const raw = localStorage.getItem(SAVED_BEACHES_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { guardadoEn?: number; playas?: unknown };
    if (!Array.isArray(parsed.playas) || parsed.playas.length === 0) return null;
    if (typeof parsed.guardadoEn !== 'number') return null;
    if (Date.now() - parsed.guardadoEn > MAX_SAVED_AGE_MS) return null;
    return parsed.playas as Beach[];
  } catch {
    return null;
  }
}

function loadFallbackBeaches(): Promise<Beach[]> {
  const saved = readSavedBeaches();
  if (saved) return Promise.resolve(saved);

  fallbackPromise ??= import('../data/beaches.json').then(
    (module) => module.default as Beach[],
  );
  return fallbackPromise;
}

function fetchBeachesOnce(): Promise<Beach[]> {
  if (beachesCache && beachesCache.expiresAt > Date.now()) {
    return Promise.resolve(beachesCache.value);
  }
  if (beachesRequest) return beachesRequest;

  beachesRequest = fetch(buildRegionApiUrl('/beaches'))
    .then((res) => {
      if (!res.ok) throw new Error('Error al obtener playas');
      return res.json() as Promise<Beach[]>;
    })
    .then((data) => {
      beachesCache = { value: data, expiresAt: Date.now() + CLIENT_CACHE_TTL_MS };
      saveBeaches(data);
      return data;
    })
    .finally(() => {
      beachesRequest = null;
    });

  return beachesRequest;
}

type GetBeachesOptions = {
  timeoutMs?: number;
  onBackendData?: (data: Beach[]) => void;
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

export async function getBeaches(options: GetBeachesOptions = {}): Promise<Beach[]> {
  const {
    timeoutMs = BEACHES_FALLBACK_TIMEOUT_MS,
    onBackendData,
    onFallback,
    onFallbackUnavailable,
  } = options;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let didReturnFallback = false;
  let didReportFallbackUnavailable = false;

  const loadFallbackOrEmpty = async (): Promise<Beach[]> => {
    try {
      return await loadFallbackBeaches();
    } catch {
      if (!didReportFallbackUnavailable) {
        didReportFallbackUnavailable = true;
        onFallbackUnavailable?.();
      }
      return [];
    }
  };

  const fetchPromise = fetchBeachesOnce()
    .then((data) => {
      if (didReturnFallback) {
        onBackendData?.(data);
      }
      return data;
    });

  const timeoutPromise = new Promise<Beach[]>((resolve) => {
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
export interface BeachAttributes {
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

export interface RedCrossStation {
  id?: number;
  nombreFuente: string;
}

export interface BeachSector {
  nombre: string;
  longitud?: number;
}

export interface Beach {
  nombre: string;
  municipio: string;
  codigo: string;
  lat: number;
  lon: number;
  idCruzRoja?: number;
  cruzRojaStations?: RedCrossStation[];
  /**
   * Operator watching the beach ("Cruz Roja"), null if nobody does. Optional
   * because the local fallback catalog and older backends do not carry it —
   * resolve it with `operadorVigilancia`, never read it raw.
   */
  fuenteBanderas?: string | null;
  alias?: string[];
  sectores?: BeachSector[];
  atributos?: BeachAttributes;
  longitud?: number;
  anchura?: number;
  tipoPlaya?: string;
  arena?: string;
  acceso?: string[];
  parkingDescripcion?: string;
  bus?: string;
  hospitalDistancia?: number;
  submarinismo?: boolean;
  webcam?: BeachWebcam | null;
  /** Year of the current Blue Flag award (ADEAC); absent/null if none. */
  banderaAzul?: number | null;
}

// ------------------------------
// Cruz Roja data
// ------------------------------
export interface RedCrossData {
  bandera?: string;
  coberturaDesde?: string;
  coberturaHasta?: string;
  horario?: string;
  ultimaActualizacion?: string;
}

// ------------------------------
// AEMET forecast
// ------------------------------
export interface AemetForecastDay {
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

export interface AemetData {
  elaborado: string;
  prediccion: {
    dia: AemetForecastDay[];
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
/**
 * A value of the day nobody measured and no model forecast: the backend
 * derived it (waves from wind, sensation from temperature, UV from
 * cloudiness) or filled it with a default (water). The list travels so the UI
 * can stop showing a guess with the same face as an observation.
 */
export type EstimatedField = 'sensacion' | 'viento' | 'oleaje' | 'uv' | 'agua';

export interface ForecastDay {
  summary: string;
  temperature: number;
  waterTemperature: number;
  sensation: string;
  wind: string;
  waves: string;
  uvIndex?: number;
  icon: string;
  /** Optional: a backend that predates it simply marks nothing. */
  estimados?: EstimatedField[] | null;
}

export interface WeatherData {
  fuente: 'AEMET' | 'OpenWeatherMap';
  ultimaActualizacion: string;
  hoy: ForecastDay;
  manana: ForecastDay;
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

export interface ForecastDayDTO {
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

export interface FullForecastDTO {
  fuente: 'AEMET_XML' | 'AEMET_HTML';
  elaboracion: string | null;
  zonaAvisos: string | null;
  dias: ForecastDayDTO[];
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
export interface ExpectedRain {
  /** ISO of the first interval with precipitation; null if the signal is textual only (AEMET). */
  desdeIso: string | null;
  mm: number | null;
  fuentes: string[];
}

export interface CurrentRain {
  estado: 'lloviendo' | 'sin_lluvia' | 'desconocido';
  mm: number | null;
  /** true = only the AEMET rain gauge triggered the signal (it rained in the last hour). */
  ultimaHora: boolean;
  fuentes: string[];
  timestamp: string;
  prevista?: ExpectedRain | null;
}

/** One hour of the outlook the score is judging (already trimmed by the backend). */
export interface HourlyForecast {
  horaIso: string;
  nubesPct: number | null;
  temperaturaC: number | null;
  vientoMs: number | null;
  /** Forecast rain for this hour. Optional: older backends do not send it. */
  precipitacionMm?: number | null;
}

export interface CurrentConditions {
  cielo: string | null;
  icono: number | null;
  temperatura: number | null;
  precipitacionMm: number | null;
  fuente: string;
  timestamp: string;
  lluvia?: CurrentRain | null;
  /** Next few hours. Absent when Open-Meteo is down or outside the beach window. */
  previsionHoras?: HourlyForecast[] | null;
  /** Who forecast those hours, as the API credits it. */
  previsionHorasFuente?: string | null;
  /** WHEN to go today. Same shape as the listing's field. */
  ventanaDia?: DayWindow | null;
  /** Who forecast the window's hours, as the API credits it. */
  ventanaDiaFuente?: string | null;
  /**
   * Whether the provider considers this observation to be at night. It is its
   * own day/night call, so it follows the real sunset at these coordinates
   * instead of an hour threshold that would be wrong for half the year.
   * Optional: an older backend sends nothing and the UI assumes daytime.
   */
  esNoche?: boolean | null;
}

// ------------------------------
// Beach detail
// ------------------------------

/**
 * A beach's webcam (static editorial data). `cobertura` distinguishes whether it points
 * exactly at this beach, at a shared panorama, or at a nearby beach. It is only
 * offered as an external link (not embedded).
 */
export interface BeachWebcam {
  url: string;
  cobertura: 'exacta' | 'compartida' | 'cercana';
  estado?: 'activa' | 'desactivada';
}

/**
 * Tide table borrowed from the nearest beach that has one, for a beach with
 * no AEMET sheet of its own. `mareas` is indexed by day like
 * `PrediccionCompletaDTO['mareas']` — index 0 is today.
 */
export interface TideReference {
  playa: string;
  municipio: string;
  distanciaKm: number;
  mareas: Array<{ pleamar: string[]; bajamar: string[] }>;
  fuenteMareas: string | null;
}

export interface BeachDetail {
  nombre: string;
  municipio: string;
  codigo: string;
  lat?: number;
  lon?: number;
  atributos?: BeachAttributes;
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
  tiempoActual?: CurrentConditions | null;

  // Standardized weather data
  clima?: WeatherData;

  // Operator watching the beach; null = no lifeguard flag service here.
  fuenteBanderas?: string | null;

  // May be absent
  cruzRoja?: RedCrossData;

  // Enriched forecast (3 days, tides, warnings)
  prediccionCompleta?: FullForecastDTO;

  // Beach webcam (may be absent). External link only.
  webcam?: BeachWebcam | null;

  /** Year of the current Blue Flag award (ADEAC); absent/null if none. */
  banderaAzul?: number | null;

  /**
   * Present only when this beach has no AEMET sheet of its own
   * (`prediccionCompleta` is then null).
   */
  mareaReferencia?: TideReference | null;

  /**
   * When the backend ASSEMBLED this payload, not when it answered. The details
   * endpoint serves from a stale-while-revalidate cache, so a response can be
   * much older than the request that got it — this is the only way to tell the
   * user which of the two they are looking at. Optional: an older backend
   * sends nothing and the UI simply says nothing.
   */
  generadoEn?: string | null;
}

/**
 * Why the detail could not be loaded. It exists because the same sentence was
 * shown for a dead backend, a 429, an expired dev IP and a stale service
 * worker — and each of those cost a diagnosis from scratch. The cause is not
 * decoration: it is the first thing anyone needs.
 */
export class DetailError extends Error {
  /** `null` = the request never came back (network, CORS, service worker). */
  constructor(readonly status: number | null, readonly url: string) {
    super('No se pudo cargar el detalle de la playa');
    this.name = 'ErrorDetalle';
  }
}

export async function getBeachDetail(code: string): Promise<BeachDetail> {
  const url = buildRegionApiUrl(`/beaches/${code}/details`);

  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    // A rejected fetch has no status: the request never made it back. Network
    // down, CORS, or something intercepting it (a service worker, a proxy).
    const detail = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error(`[detalle] sin respuesta de ${url}: ${detail}`);
    throw new DetailError(null, url);
  }

  if (!res.ok) {
    // eslint-disable-next-line no-console
    console.error(`[detalle] ${url} respondió ${res.status}`);
    throw new DetailError(res.status, url);
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
  subpuntuaciones?: SubScores | null;
  pronostico?: Outlook | null;
  topeAplicado?: 'lluvia' | 'lluvia_prevista' | null;
  /** The cap value behind `topeAplicado`. Older backends do not send it. */
  topeValor?: number | null;
  oleaje?: string | null;
  ventanaDia?: DayWindow | null;
  /**
   * Live rain signal, same aggregated nowcast the detail carries in
   * `tiempoActual.lluvia`. Optional for the usual backward-compatibility
   * reason: without it the icon falls back to the sky description alone.
   */
  lluvia?: CurrentRain | null;
}

/**
 * WHEN to go today: best stretch of the remaining beach window, plus the first
 * turn for the worse after it. Instants come as ISO and the cause as a key
 * (the `CausaPronostico` vocabulary): the client composes and localizes
 * "Mejor momento: 11:00–14:00 · a partir de las 17:00 aumenta el viento".
 * Optional for the same backward-compatibility reason as `pronostico`.
 */
export interface DayWindow {
  inicio: string;
  fin: string;
  cambio?: { desde: string; causa: OutlookCause | null } | null;
  /**
   * Why this stretch beats the rejected hours. Optional for the usual
   * backward-compatibility reason: without it only the time range is shown.
   */
  motivo?: WindowReason | null;
  /** Forecast hours the verdict is built on. Optional, same reason. */
  horasConsideradas?: number;
}

export type WindowReason = 'sin_lluvia' | 'despeja' | 'sube_temperatura' | 'amaina_viento';

/**
 * Points scored on each factor, before caps and outlook. There is no UV factor:
 * a high index is a reason to bring sunscreen, not to rate the beach worse.
 */
export interface SubScores {
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
export interface Outlook {
  direccion: 'mejora' | 'empeora' | 'estable';
  delta: number;
  causa?: OutlookCause | null;
}

export type OutlookCause =
  | 'despeja'
  | 'nubla'
  | 'sube_temperatura'
  | 'baja_temperatura'
  | 'amaina_viento'
  | 'arrecia_viento'
  | 'lluvia_prevista';

export interface FeaturedBeachesResponse {
  timestamp: number;
  /**
   * When the backend built THIS response, as opposed to when it assembled the
   * ranking. Breaks the tie between two responses carrying the same ranking
   * with the flags judged at different moments. Optional: an older backend
   * does not send it.
   */
  servidoEn?: number;
  playas: FeaturedBeach[];
  revisar: FeaturedBeach[];
  resumenTodas: FeaturedBeach[];
  /** Reachable maximum of each factor, so the bars cannot drift from the model. */
  maximos?: SubScores | null;
}

let featuredRequest: Promise<FeaturedBeachesResponse> | null = null;
let featuredCache: { value: FeaturedBeachesResponse; expiresAt: number } | null = null;

export async function getFeaturedBeaches(
  options: { force?: boolean } = {},
): Promise<FeaturedBeachesResponse> {
  if (!options.force && featuredCache && featuredCache.expiresAt > Date.now()) {
    return featuredCache.value;
  }
  // `force` does NOT join the request in flight: that request is very often
  // the one that produced the body being escaped from — the retry would hand
  // back the same old ranking and call it an answer. Deduplication is for
  // ordinary callers.
  if (!options.force && featuredRequest) return featuredRequest;

  featuredRequest = fetch(buildRegionApiUrl('/beaches/featured'))
    .then((res) => {
      if (!res.ok) throw new Error('No se pudieron cargar las playas destacadas');
      return res.json() as Promise<FeaturedBeachesResponse>;
    })
    // Whatever comes back from `guardarFeatured` is what every other screen
    // will read, so it is what this caller gets too: two surfaces painting two
    // different rankings is the bug, whichever of them is the newer one.
    .then(saveFeatured)
    .finally(() => {
      featuredRequest = null;
    });

  return featuredRequest;
}

/** Path suffix of the ranking endpoint, so the pages don't each spell it out. */
export const FEATURED_ROUTE = '/beaches/featured';

/**
 * Single writer of `featuredCache`, because there are two of them racing: the
 * request the app has in flight, and the body the service worker hands over
 * when the response it had given up on finally lands. They can finish in
 * either order, and whoever wrote last used to win — so a request that was
 * resolved with the worker's stored copy could put the superseded ranking
 * back on top of the one the message had just delivered.
 *
 * `timestamp` orders them, and it can: the backend stamps it when the ranking
 * is ASSEMBLED and carries it inside the cached value, so a stale-while-
 * revalidate hit keeps the instant of the sky it is actually holding. Older
 * of the two loses, and losing is the right outcome — it is the older sky.
 *
 * It said the opposite until 13-sep-2026, when the instant was `Date.now()` at
 * response time and every body looked equally new. The guard worked anyway,
 * because that stamp still ordered them by when the API had served each one;
 * now it orders them by the data, which is what it was always reaching for.
 */
/**
 * Is `candidato` the older reading of the two?
 *
 * Two levels, because two different things can make one body older. The ranking
 * itself is ordered by `timestamp`, the instant it was assembled. But the SAME
 * assembled ranking goes out many times from the backend's stale cache, and
 * each of those responses judges the lifeguard flags again against the clock:
 * a green that was current at 10:00 is published as no flag at all by 19:00.
 * So on a tie it is `servidoEn` that decides — otherwise the 10:00 reading,
 * arriving second from a cache, would put the flag back on a beach whose
 * reading had already expired. That is the one direction this must never fail
 * in. A backend that predates `servidoEn` sends nothing and ties simply resolve
 * in favour of what is already painted, as they did before.
 */
function isPrevious(
  candidate: FeaturedBeachesResponse,
  current: FeaturedBeachesResponse,
): boolean {
  if (typeof candidate.timestamp !== 'number' || typeof current.timestamp !== 'number') {
    return false;
  }
  if (candidate.timestamp !== current.timestamp) return candidate.timestamp < current.timestamp;
  if (typeof candidate.servidoEn !== 'number' || typeof current.servidoEn !== 'number') {
    return false;
  }
  return candidate.servidoEn < current.servidoEn;
}

/**
 * The ranking every screen paints, and who to tell when it changes.
 *
 * The cache above answers a request; this is the value IN FORCE, and the two
 * are not the same thing. Ionic keeps visited pages mounted, so five screens
 * can be alive at once: with a copy per screen, the one that happened to fire
 * the request repainted and the rest kept the sky they had loaded — the exact
 * split this module exists to prevent. There is one value and one list of
 * screens to wake.
 */
let currentRanking: FeaturedBeachesResponse | null = null;
const subscribers = new Set<() => void>();

/** Subscribe to the ranking in force; returns the unsubscribe. */
export function subscribeRanking(onChange: () => void): () => void {
  subscribers.add(onChange);
  return () => { subscribers.delete(onChange); };
}

/** The ranking in force, or null before the first answer of the session. */
export function readCurrentRanking(): FeaturedBeachesResponse | null {
  return currentRanking;
}

function saveFeatured(value: FeaturedBeachesResponse): FeaturedBeachesResponse {
  // Only a ranking that is still IN FORCE gets a vote. An expired entry is one
  // nobody will be served again — letting it veto meant a plain refetch after
  // the minute was up could be thrown away for losing to something already
  // dead, and the screen kept painting from the discarded body.
  const inForce = featuredCache && featuredCache.expiresAt > Date.now();
  const inCache = inForce ? featuredCache?.value : undefined;
  if (inCache && isPrevious(value, inCache)) return inCache;
  featuredCache = { value, expiresAt: Date.now() + FEATURED_CACHE_TTL_MS };
  // Only a body that actually WINS wakes the screens: re-serving the same
  // value would repaint five pages for nothing.
  if (currentRanking !== value) {
    currentRanking = value;
    subscribers.forEach((onChange) => onChange());
  }
  return value;
}

/**
 * Takes in the ranking that arrived AFTER the service worker had already
 * served its stored copy, and returns the one now in force.
 *
 * It has to land here and not only on the page that received the message: this
 * module cache is what every surface reads, and while it kept the superseded
 * value the map, the list and the landings went on painting the old sky — and
 * coming back to the home page re-served it from here, undoing the repaint the
 * message had just produced.
 */
export function applyFreshFeatured(
  value: FeaturedBeachesResponse,
): FeaturedBeachesResponse {
  return saveFeatured(value);
}

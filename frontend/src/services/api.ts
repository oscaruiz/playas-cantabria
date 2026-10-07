import { buildRegionApiUrl } from '../shared/config/api';
import type {
  BeachAttributesDTO,
  BeachDTO,
  BeachSectorDTO,
  CampoEstimado,
  ClimaDiaDTO,
  ClimaDTO,
  CruzRojaDTO,
  CruzRojaStationDTO,
  DetailsDTO,
  FeaturedBeachDTO,
  FeaturedBeachesResponseDTO,
  LluviaDTO,
  LluviaPrevistaDTO,
  MareaReferenciaDTO,
  PrediccionCompletaDTO,
  PrevisionHoraDTO,
  PronosticoDTO,
  SubPuntuacionesDTO,
  TiempoActualDTO,
  VentanaDiaDTO,
  WebcamDTO,
} from '../contract/api';

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
   * Called if the local copy cannot be loaded either. `getBeaches` keeps its
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
      // promise hanging forever (infinite spinner): getBeaches resolves
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
// API models
// ------------------------------
// The JSON shapes come from the backend contract (`src/contract/api.ts`, a
// generated copy of `backend/src/contract/`): never write them by hand here.
// These are the app's English names for them, plus the ONE deliberate
// difference: `Additive<T, K>` loosens the fields K to optional, because an
// installed app can be talking to an older backend, or reading a response
// cached by the service worker, that predates them. K must be a real key of
// the contract, so a renamed or removed field still fails the type-check.
type Additive<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/** Indexable, because the UI iterates over whichever amenities a beach has. */
export type BeachAttributes = BeachAttributesDTO & Record<string, boolean | undefined>;
export type RedCrossStation = CruzRojaStationDTO;
export type BeachSector = BeachSectorDTO;
export type BeachWebcam = WebcamDTO;

/**
 * A list beach. `fuenteBanderas` and `idCruzRoja` are optional because the
 * local fallback catalog (`data/beaches.json`) and older backends do not carry
 * them — resolve the operator with `lifeguardOperator`, never read it raw.
 */
export type Beach = Additive<BeachDTO, 'fuenteBanderas' | 'idCruzRoja'>;

export type RedCrossData = CruzRojaDTO;

export type EstimatedField = CampoEstimado;
export type ForecastDay = ClimaDiaDTO;
export type WeatherData = ClimaDTO;

export type FullForecastDTO = PrediccionCompletaDTO;
export type ForecastDayDTO = PrediccionCompletaDTO['dias'][number];
export type HalfDayDTO = ForecastDayDTO['manana'];

export type ExpectedRain = LluviaPrevistaDTO;
export type CurrentRain = LluviaDTO;
export type HourlyForecast = PrevisionHoraDTO;
/** Nested `ventanaDia` uses the tolerant `DayWindow`, like the listing's. */
export type CurrentConditions = Omit<TiempoActualDTO, 'ventanaDia'> & { ventanaDia?: DayWindow | null };
export type TideReference = MareaReferenciaDTO;

/**
 * Everything but the identity is optional: the detail renders whatever it got
 * (an older backend, a service-worker cache, a partial fixture) section by
 * section. The types of the fields are still the contract's.
 */
export type BeachDetail = Omit<
  Additive<DetailsDTO, Exclude<keyof DetailsDTO, 'nombre' | 'municipio' | 'codigo'>>,
  'tiempoActual'
> & { tiempoActual?: CurrentConditions | null };

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
export type SubScores = SubPuntuacionesDTO;
export type OutlookCause = NonNullable<PronosticoDTO['causa']>;
export type Outlook = Additive<PronosticoDTO, 'causa'>;
export type WindowReason = NonNullable<VentanaDiaDTO['motivo']>;
export type DayWindow = Additive<VentanaDiaDTO, 'cambio'>;

/** Nested `pronostico`/`ventanaDia` use the tolerant `Outlook`/`DayWindow` too. */
export type FeaturedBeach = Omit<
  Additive<
    FeaturedBeachDTO,
    'subpuntuaciones' | 'pronostico' | 'topeAplicado' | 'topeValor' | 'oleaje' | 'ventanaDia' | 'lluvia'
  >,
  'pronostico' | 'ventanaDia'
> & {
  pronostico?: Outlook | null;
  ventanaDia?: DayWindow | null;
};

export type FeaturedBeachesResponse = Omit<
  Additive<FeaturedBeachesResponseDTO, 'servidoEn' | 'maximos'>,
  'playas' | 'revisar' | 'resumenTodas'
> & {
  playas: FeaturedBeach[];
  revisar: FeaturedBeach[];
  resumenTodas: FeaturedBeach[];
};

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

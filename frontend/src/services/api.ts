import { buildApiUrl } from '../config/api';
import fallbackPlayas from '../data/beaches.json';

const PLAYAS_FALLBACK_TIMEOUT_MS = 2500;

type GetPlayasOptions = {
  timeoutMs?: number;
  onBackendData?: (data: Playa[]) => void;
};

export async function getPlayas(options: GetPlayasOptions = {}): Promise<Playa[]> {
  const { timeoutMs = PLAYAS_FALLBACK_TIMEOUT_MS, onBackendData } = options;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let didReturnFallback = false;

  const fetchPromise = fetch(buildApiUrl('/api/beaches'))
    .then((res) => {
      if (!res.ok) throw new Error('Error al obtener playas');
      return res.json() as Promise<Playa[]>;
    })
    .then((data) => {
      if (didReturnFallback) {
        onBackendData?.(data);
      }
      return data;
    });

  const timeoutPromise = new Promise<Playa[]>((resolve) => {
    timeoutId = setTimeout(() => {
      didReturnFallback = true;
      resolve(fallbackPlayas as Playa[]);
    }, timeoutMs);
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    return fallbackPlayas as Playa[];
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

// ------------------------------
// Modelos base
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
// Datos de Cruz Roja
// ------------------------------
export interface DatosCruzRoja {
  bandera?: string;
  coberturaDesde?: string;
  coberturaHasta?: string;
  horario?: string;
  ultimaActualizacion?: string;
}

// ------------------------------
// Predicción de AEMET
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
// Predicción del Tiempo
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
// Predicción completa (AEMET web scraper)
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
// Tiempo real "ahora" (observación, con prioridad sobre la previsión)
// ------------------------------
/**
 * Señal agregada "¿está lloviendo ahora?" (multi-fuente en backend:
 * OpenWeather + pluviómetro AEMET + Open-Meteo). Campo aditivo.
 */
/** Lluvia PREVISTA (próximas ~6h Open-Meteo ∪ texto AEMET restante de hoy). */
export interface LluviaPrevista {
  /** ISO del primer tramo con precipitación; null si la señal es solo textual (AEMET). */
  desdeIso: string | null;
  mm: number | null;
  fuentes: string[];
}

export interface LluviaActual {
  estado: 'lloviendo' | 'sin_lluvia' | 'desconocido';
  mm: number | null;
  /** true = solo el pluviómetro AEMET disparó la señal (llovió en la última hora). */
  ultimaHora: boolean;
  fuentes: string[];
  timestamp: string;
  prevista?: LluviaPrevista | null;
}

export interface TiempoActual {
  cielo: string | null;
  icono: number | null;
  temperatura: number | null;
  precipitacionMm: number | null;
  fuente: string;
  timestamp: string;
  lluvia?: LluviaActual | null;
}

// ------------------------------
// Detalle de Playa
// ------------------------------

/**
 * Webcam de una playa (dato editorial estático). `cobertura` distingue si enfoca
 * exactamente esta playa, una panorámica compartida o una playa cercana. Solo se
 * ofrece como enlace externo (no se embebe).
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

  // Observación en tiempo real para HOY (cielo/temp/lluvia reales)
  tiempoActual?: TiempoActual | null;

  // Datos meteorológicos estandarizados
  clima?: DatosClima;

  // Puede no venir
  cruzRoja?: DatosCruzRoja;

  // Predicción enriquecida (3 días, mareas, avisos)
  prediccionCompleta?: PrediccionCompletaDTO;

  // Webcam de la playa (puede no venir). Solo enlace externo.
  webcam?: WebcamPlaya | null;
}

export async function getDetallePlaya(codigo: string): Promise<PlayaDetalle> {
  const res = await fetch(buildApiUrl(`/api/beaches/${codigo}/details`));

  if (!res.ok) throw new Error('No se pudo cargar el detalle de la playa');
  return res.json();
}

// ------------------------------
// Playas destacadas (featured)
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
}

export interface FeaturedBeachesResponse {
  timestamp: number;
  playas: FeaturedBeach[];
  revisar: FeaturedBeach[];
  resumenTodas: FeaturedBeach[];
}

export async function getFeaturedBeaches(): Promise<FeaturedBeachesResponse> {
  const res = await fetch(buildApiUrl('/api/beaches/featured'));
  if (!res.ok) throw new Error('No se pudieron cargar las playas destacadas');
  return res.json();
}

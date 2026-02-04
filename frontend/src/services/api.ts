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
export interface Playa {
  nombre: string;
  municipio: string;
  codigo: string;
  lat: number;
  lon: number;
  idCruzRoja?: number; // Algunos no lo tienen
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
// Detalle de Playa
// ------------------------------
export interface PlayaDetalle {
  nombre: string;
  municipio: string;
  codigo: string;

  // Datos meteorológicos estandarizados
  clima?: DatosClima;

  // Puede no venir
  cruzRoja?: DatosCruzRoja;
}

export async function getDetallePlaya(codigo: string): Promise<PlayaDetalle> {
  const res = await fetch(buildApiUrl(`/api/beaches/${codigo}/details`));

  if (!res.ok) throw new Error('No se pudo cargar el detalle de la playa');
  return res.json();
}

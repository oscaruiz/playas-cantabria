export async function getPlayas(): Promise<Playa[]> {
  const res = await fetch('http://localhost:4000/api/playas');
  // const res = await fetch('https://us-central1-playas-cantabria.cloudfunctions.net/api/api/playas/');
  if (!res.ok) throw new Error('Error al obtener playas');
  return res.json();
}

// ------------------------------
// Modelos base
// ------------------------------
export interface Playa {
  nombre: string;
  municipio: string;
  codigo: string;
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
  const res = await fetch(`http://localhost:4000/api/playas/${codigo}`);
  // const res = await fetch(`https://us-central1-playas-cantabria.cloudfunctions.net/api/api/playas/${codigo}`);

  if (!res.ok) throw new Error('No se pudo cargar el detalle de la playa');
  return res.json();
}

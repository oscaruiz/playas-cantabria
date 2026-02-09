const API_BASE_URL = "https://playas-cantabria.onrender.com"

export interface Playa {
  nombre: string
  municipio: string
  codigo: string
  lat: number
  lon: number
  idCruzRoja?: number
}

export interface DatosCruzRoja {
  bandera?: string
  coberturaDesde?: string
  coberturaHasta?: string
  horario?: string
  ultimaActualizacion?: string
}

export interface PrediccionDia {
  summary: string
  temperature: number
  waterTemperature: number
  sensation: string
  wind: string
  waves: string
  uvIndex?: number
  icon: string
  fecha?: number
}

export interface DatosClima {
  fuente: "AEMET" | "OpenWeatherMap"
  ultimaActualizacion: string
  hoy: PrediccionDia
  manana: PrediccionDia
}

export interface PlayaDetalle {
  nombre: string
  municipio: string
  codigo: string
  clima?: DatosClima
  cruzRoja?: DatosCruzRoja
}

export async function getPlayas(): Promise<Playa[]> {
  const res = await fetch(`${API_BASE_URL}/api/beaches`, {
    next: { revalidate: 300 },
  })
  if (!res.ok) throw new Error("Error al obtener playas")
  return res.json()
}

export async function getDetallePlaya(codigo: string): Promise<PlayaDetalle> {
  const res = await fetch(`${API_BASE_URL}/api/beaches/${codigo}/details`, {
    next: { revalidate: 120 },
  })
  if (!res.ok) throw new Error("No se pudo cargar el detalle de la playa")
  return res.json()
}

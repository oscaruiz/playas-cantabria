import { BeachDetails } from '../../domain/use-cases/GetBeachDetails';
import { Beach, BeachAttributes, Webcam } from '../../domain/entities/Beach';
import { FlagStatus } from '../../domain/entities/Flag';
import { resolveFlagOperatorName } from '../../domain/services/flagAggregation';
import { Weather } from '../../domain/entities/Weather';
import { RainNowcast } from '../../domain/entities/RainNowcast';
import { RainForecastSignal } from '../../domain/use-cases/RainForecast';

export type ClimaDiaDTO = {
  summary: string | null;
  temperature: number | null;
  waterTemperature: number | null;
  sensation: string | null;
  wind: string | null;
  waves: string | null;
  uvIndex: number | null;
  icon: number | null;
};

export type ClimaDTO = {
  fuente: 'AEMET' | 'OpenWeather';
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

export type TiempoActualDTO = {
  cielo: string | null;
  icono: number | null;
  temperatura: number | null;
  precipitacionMm: number | null;
  fuente: 'OpenWeather' | 'AEMET';
  timestamp: string;
  lluvia?: LluviaDTO | null;
};

type CruzRojaDTO = {
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

export type LegacyDetailsDTO = {
  nombre: string;
  municipio: string;
  codigo: string;
  lat: number;
  lon: number;
  atributos: BeachAttributes | null;
  longitud: number | null;
  anchura: number | null;
  tipoPlaya: string | null;
  arena: string | null;
  acceso: string[] | null;
  parkingDescripcion: string | null;
  bus: string | null;
  hospitalDistancia: number | null;
  submarinismo: boolean | null;
  webcam: Webcam | null;
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
};

export class LegacyDetailsMapper {
  static toDTO(details: BeachDetails): LegacyDetailsDTO {
    const { beach, weather, flag } = details;

    return {
      ...this.mapBeach(beach),
      temperaturaActual: weather?.temperatureC ?? null,
      tiempoActual: null, // populated by LegacyDetailsAssembler from OpenWeather current
      clima: weather ? this.mapClima(weather) : null,
      fuenteBanderas: resolveFlagOperatorName(beach.flagRef, beach.flagStations),
      cruzRoja: flag ? this.mapCruzRoja(flag) : null,
      prediccionCompleta: null,
    };
  }

  /** Maps the aggregated rain signal to the DTO (Spanish values). */
  static mapLluvia(r: RainNowcast): LluviaDTO {
    const estado =
      r.status === 'raining' ? 'lloviendo' : r.status === 'dry' ? 'sin_lluvia' : 'desconocido';
    return {
      estado,
      mm: r.precipitationMm ?? null,
      ultimaHora: r.lastHourOnly,
      fuentes: r.sources.map((s) => s.source),
      timestamp: new Date(r.timestamp).toISOString(),
    };
  }

  /** Maps the forecast rain signal to the DTO. */
  static mapLluviaPrevista(s: RainForecastSignal): LluviaPrevistaDTO {
    return {
      desdeIso: s.firstAt != null ? new Date(s.firstAt).toISOString() : null,
      mm: s.mmMax ?? null,
      fuentes: s.sources,
    };
  }

  /** Maps a current observation (OpenWeather current) to TODAY's "real time" block. */
  static mapTiempoActual(w: Weather): TiempoActualDTO {
    return {
      cielo: w.description ?? null,
      icono: this.iconToLegacy(w.source, w.icon),
      temperatura: w.temperatureC ?? null,
      precipitacionMm: w.precipitationMm ?? null,
      fuente: w.source,
      timestamp: new Date(w.timestamp).toISOString(),
    };
  }

  private static mapBeach(b: Beach) {
    return {
      nombre: b.name,
      municipio: b.municipality,
      codigo: b.aemetCode,
      lat: b.latitude,
      lon: b.longitude,
      atributos: b.attributes ?? null,
      longitud: b.lengthM ?? null,
      anchura: b.widthM ?? null,
      tipoPlaya: b.beachType ?? null,
      arena: b.sandType ?? null,
      acceso: b.access ?? null,
      parkingDescripcion: b.parkingDescription ?? null,
      bus: b.busInfo ?? null,
      hospitalDistancia: b.hospitalDistanceKm ?? null,
      submarinismo: b.diving ?? null,
      webcam: b.webcam ?? null,
    };
  }

  private static mapClima(w: Weather): ClimaDTO {
    const hoy: ClimaDiaDTO = {
      summary: this.capFirst(w.description),
      temperature: w.temperatureC ?? null,
      waterTemperature: null,
      sensation: this.sensationFromTemp(w.temperatureC),
      wind: this.describeWind(w.windSpeedMs),
      waves: null,
      uvIndex: null,
      icon: this.iconToLegacy(w.source, w.icon),
    };
    return {
      fuente: w.source,
      ultimaActualizacion: new Date(w.timestamp).toISOString(),
      hoy,
      manana: null,
    };
  }

  private static mapCruzRoja(f: FlagStatus): CruzRojaDTO {
    return {
      bandera: this.flagToEs(f),
      coberturaDesde: f.coverageFrom ?? null,
      coberturaHasta: f.coverageTo ?? null,
      horario: f.schedule ?? null,
      ultimaActualizacion: new Date(f.timestamp).toISOString(),
    };
  }

  private static flagToEs(f: FlagStatus): CruzRojaDTO['bandera'] {
    switch (f.color) {
      case 'green':
        return 'Verde';
      case 'yellow':
        return 'Amarilla';
      case 'red':
        return 'Roja';
      case 'black':
        return 'Negra';
      default:
        return 'Desconocida';
    }
  }

  private static describeWind(windMs: number | null): string | null {
    if (windMs == null) return null;
    if (windMs < 3) return 'calma';
    if (windMs < 6) return 'flojo';
    if (windMs < 10) return 'moderado';
    if (windMs < 15) return 'fresco';
    return 'fuerte';
  }

  private static sensationFromTemp(t: number | null): string | null {
    if (t == null) return null;
    if (t < 10) return 'frío';
    if (t < 18) return 'templado';
    if (t < 26) return 'agradable';
    if (t < 32) return 'calor moderado';
    return 'calor intenso';
  }

  private static capFirst(s: string | null): string | null {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private static iconToLegacy(source: Weather['source'], icon: string | null): number | null {
    if (!icon) return null;
    
    if (source === 'OpenWeather' || source === 'AEMET') {
      if (icon.startsWith('01')) return 100; // ☀️ Despejado
      if (icon.startsWith('02')) return 110; // ⛅ Parcialmente nublado
      if (icon.startsWith('03')) return 110; // ⛅ Nubes dispersas (25-50%)
      if (icon.startsWith('04')) return 120; // ☁️ Nublado
      if (icon.startsWith('09') || icon.startsWith('10')) return 200; // 🌧️ Lluvia
      if (icon.startsWith('11')) return 210; // ⛈️ Tormenta
      if (icon.startsWith('13')) return 300; // ❄️ Nieve
      if (icon.startsWith('50')) return 400; // 🌫️ Niebla
    }
    
    return null;
  }
}

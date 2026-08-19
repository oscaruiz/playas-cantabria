import { BeachDetails } from '../../domain/use-cases/GetBeachDetails';
import { Beach, BeachAttributes, Webcam } from '../../domain/entities/Beach';
import { FlagStatus } from '../../domain/entities/Flag';
import { resolveFlagOperatorName } from '../../domain/services/flagAggregation';
import { Weather } from '../../domain/entities/Weather';
import { HourlyOutlookSlot, RainNowcast } from '../../domain/entities/RainNowcast';
import { RainForecastSignal } from '../../domain/use-cases/RainForecast';

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
};

export type TiempoActualDTO = {
  cielo: string | null;
  icono: number | null;
  temperatura: number | null;
  precipitacionMm: number | null;
  fuente: 'OpenWeather' | 'AEMET';
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
   * Whether the provider considers this observation to be at NIGHT. It is the
   * provider's own day/night call (the `d`/`n` suffix on its icon), which
   * accounts for the real sunrise and sunset at these coordinates — far better
   * than the client guessing from an hour threshold that would be wrong for
   * half the year. `iconToLegacy` collapses both suffixes into one number, so
   * without this the detail could not tell 3 a.m. from midday.
   */
  esNoche?: boolean;
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
      mareaReferencia: null, // populated by LegacyDetailsAssembler when the beach has no AEMET sheet
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

  /**
   * Hourly slots of the outlook window. The trimming is NOT done here: the
   * caller passes what `ventanaOutlook` selected, so the strip and the score's
   * adjustment can never disagree about which hours count.
   */
  static mapPrevisionHoras(slots: readonly HourlyOutlookSlot[]): PrevisionHoraDTO[] {
    return slots.map((s) => ({
      horaIso: new Date(s.timestamp).toISOString(),
      nubesPct: s.cloudCoverPct,
      temperaturaC: s.temperatureC,
      vientoMs: s.windSpeedMs,
    }));
  }

  /** Maps a current observation (OpenWeather current) to TODAY's "real time" block. */
  static mapTiempoActual(w: Weather): TiempoActualDTO {
    return {
      cielo: w.description ?? null,
      icono: this.iconToLegacy(w.source, w.icon),
      ...(w.icon ? { esNoche: w.icon.endsWith('n') } : {}),
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
      banderaAzul: b.blueFlagYear ?? null,
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
      // The wind DESCRIBES a measured speed; the sensation is derived from the
      // temperature, and nobody reported it.
      ...(w.temperatureC != null ? { estimados: ['sensacion' as const] } : {}),
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

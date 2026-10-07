import { BeachDetails } from '../../domain/use-cases/GetBeachDetails';
import { Beach } from '../../domain/entities/Beach';
import { FlagStatus } from '../../domain/entities/Flag';
import { resolveFlagOperatorName } from '../../domain/services/flagAggregation';
import { Weather } from '../../domain/entities/Weather';
import { HourlyOutlookSlot, RainNowcast } from '../../domain/entities/RainNowcast';
import { RainForecastSignal } from '../../domain/use-cases/RainForecast';
import type {
  ClimaDiaDTO,
  ClimaDTO,
  LluviaPrevistaDTO,
  LluviaDTO,
  PrevisionHoraDTO,
  TiempoActualDTO,
  CruzRojaDTO,
  DetailsDTO,
} from '../../contract/api';

export class DetailsMapper {
  static toDTO(details: BeachDetails): DetailsDTO {
    const { beach, weather, flag } = details;

    return {
      ...this.mapBeach(beach),
      temperaturaActual: weather?.temperatureC ?? null,
      tiempoActual: null, // populated by DetailsAssembler from OpenWeather current
      clima: weather ? this.mapClima(weather) : null,
      fuenteBanderas: resolveFlagOperatorName(beach.flagRef, beach.flagStations),
      cruzRoja: flag ? this.mapCruzRoja(flag) : null,
      prediccionCompleta: null,
      mareaReferencia: null, // populated by DetailsAssembler when the beach has no AEMET sheet
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
      precipitacionMm: s.precipitationMm ?? null,
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

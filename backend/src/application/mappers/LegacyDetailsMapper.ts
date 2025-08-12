import { BeachDetails } from '../../domain/use-cases/GetBeachDetails';
import { Beach } from '../../domain/entities/Beach';
import { FlagStatus } from '../../domain/entities/Flag';
import { Weather } from '../../domain/entities/Weather';

type ClimaDiaDTO = {
  summary: string | null;
  temperature: number | null;
  waterTemperature: number | null;
  sensation: string | null;
  wind: string | null;
  waves: string | null;
  uvIndex: number | null;
  icon: number | null;
};

type ClimaDTO = {
  fuente: 'AEMET' | 'OpenWeather';
  ultimaActualizacion: string;
  hoy: ClimaDiaDTO;
  manana: ClimaDiaDTO | null;
};

type CruzRojaDTO = {
  bandera: 'Verde' | 'Amarilla' | 'Roja' | 'Negra' | 'Desconocida';
  coberturaDesde?: string | null;
  coberturaHasta?: string | null;
  horario?: string | null;
  ultimaActualizacion: string;
};

export type LegacyDetailsDTO = {
  nombre: string;
  municipio: string;
  codigo: string;
  clima: ClimaDTO | null;
  cruzRoja: CruzRojaDTO | null;
};

export class LegacyDetailsMapper {
  static toDTO(details: BeachDetails): LegacyDetailsDTO {
    const { beach, weather, flag } = details;

    return {
      ...this.mapBeach(beach),
      clima: weather ? this.mapClima(weather) : null,
      cruzRoja: flag ? this.mapCruzRoja(flag) : null,
    };
  }

  private static mapBeach(b: Beach) {
    return { nombre: b.name, municipio: b.municipality, codigo: b.aemetCode };
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
      coberturaDesde: null,
      coberturaHasta: null,
      horario: null,
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
    if (source === 'OpenWeather') {
      if (icon.startsWith('01')) return 100;
      if (icon.startsWith('02')) return 110;
      if (icon.startsWith('03') || icon.startsWith('04')) return 120;
      if (icon.startsWith('09') || icon.startsWith('10')) return 200;
      if (icon.startsWith('11')) return 210;
      if (icon.startsWith('13')) return 300;
      if (icon.startsWith('50')) return 400;
    }
    return null;
  }
}

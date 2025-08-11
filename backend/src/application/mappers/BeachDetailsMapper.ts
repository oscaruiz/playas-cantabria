import { BeachDetails } from '../../domain/use-cases/GetBeachDetails';
import { BeachMapper } from './BeachMapper';
import { BeachDetailsDTO, FlagDTO, TidesDTO, WeatherDTO } from '../dtos/BeachDetailsDTO';

export class BeachDetailsMapper {
  static toDTO(details: BeachDetails): BeachDetailsDTO {
    return {
      beach: BeachMapper.toDTO(details.beach),
      weather: details.weather ? this.mapWeather(details.weather) : null,
      flag: details.flag ? this.mapFlag(details.flag) : null,
      tides: details.tides ? this.mapTides(details.tides) : null,
    };
  }

  private static mapWeather(w: import('../../domain/entities/Weather').Weather): WeatherDTO {
    return {
      source: w.source,
      timestamp: w.timestamp,
      temperatureC: w.temperatureC,
      description: w.description,
      icon: w.icon,
      windSpeedMs: w.windSpeedMs,
      windDirectionDeg: w.windDirectionDeg,
      humidityPct: w.humidityPct,
      pressureHPa: w.pressureHPa,
    };
    // Note: Icons/descriptions remain provider-agnostic here.
  }

  private static mapFlag(f: import('../../domain/entities/Flag').FlagStatus): FlagDTO {
    return {
      color: f.color,
      message: f.message,
      timestamp: f.timestamp,
    };
  }

  private static mapTides(t: import('../../domain/entities/Tides').Tides): TidesDTO {
    return {
      source: t.source,
      events: t.events.map((e) => ({
        time: e.time,
        heightMeters: e.heightMeters,
        type: e.type,
      })),
    };
  }
}

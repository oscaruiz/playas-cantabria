import { Beach } from '../../domain/entities/Beach';
import { Weather } from '../../domain/entities/Weather';
import { FlagStatus } from '../../domain/entities/Flag';
import { FeaturedBeachDTO, FeaturedBeachesResponseDTO } from '../dtos/FeaturedBeachDTO';

export interface FeaturedBeachResult {
  beach: Beach;
  weather: Weather | null;
  flag: FlagStatus | null;
  score: number;
  reason: string;
  downgradeReason: string | null;
}

const FLAG_COLOR_ES: Record<string, 'Verde' | 'Amarilla' | 'Roja'> = {
  green: 'Verde',
  yellow: 'Amarilla',
  red: 'Roja',
};

export class FeaturedBeachMapper {
  static toDTO(
    mejores: FeaturedBeachResult[],
    revisar: FeaturedBeachResult[],
    resumenTodas: FeaturedBeachResult[],
    timestamp: number,
  ): FeaturedBeachesResponseDTO {
    return {
      timestamp,
      playas: mejores.map((r) => this.mapOne(r)),
      revisar: revisar.map((r) => this.mapOne(r)),
      resumenTodas: resumenTodas.map((r) => this.mapOne(r)),
    };
  }

  private static mapOne(r: FeaturedBeachResult): FeaturedBeachDTO {
    return {
      nombre: r.beach.name,
      municipio: r.beach.municipality,
      codigo: r.beach.aemetCode,
      lat: r.beach.latitude,
      lon: r.beach.longitude,
      temperatura: r.weather?.temperatureC ?? null,
      descripcionClima: r.weather?.description ?? null,
      iconoClima: r.weather?.icon ?? null,
      vientoMs: r.weather?.windSpeedMs ?? null,
      bandera: r.flag?.color ? (FLAG_COLOR_ES[r.flag.color] ?? null) : null,
      puntuacion: r.score,
      razonRanking: r.reason,
      motivoBaja: r.downgradeReason ?? null,
      atributos: r.beach.attributes ?? null,
    };
  }
}

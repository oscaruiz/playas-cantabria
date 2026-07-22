import { Beach } from '../../domain/entities/Beach';
import { Weather } from '../../domain/entities/Weather';
import { FlagStatus } from '../../domain/entities/Flag';
import { ForecastEnrichment } from '../../domain/use-cases/BeachScorer';
import { FeaturedBeachDTO, FeaturedBeachesResponseDTO } from '../dtos/FeaturedBeachDTO';
import { esBanderaVigente } from './flagVigencia';

export interface FeaturedBeachResult {
  beach: Beach;
  weather: Weather | null;
  flag: FlagStatus | null;
  score: number;
  reason: string;
  downgradeReason: string | null;
  enrichment: ForecastEnrichment | null;
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
    // "Ahora" único para toda la respuesta: decide qué banderas siguen vigentes.
    const ahora = new Date(timestamp);
    return {
      timestamp,
      playas: mejores.map((r) => this.mapOne(r, ahora)),
      revisar: revisar.map((r) => this.mapOne(r, ahora)),
      resumenTodas: resumenTodas.map((r) => this.mapOne(r, ahora)),
    };
  }

  private static mapOne(r: FeaturedBeachResult, ahora: Date): FeaturedBeachDTO {
    return {
      nombre: r.beach.name,
      municipio: r.beach.municipality,
      codigo: r.beach.aemetCode,
      lat: r.beach.latitude,
      lon: r.beach.longitude,
      temperatura: r.weather?.temperatureC ?? r.enrichment?.temperatureC ?? null,
      // Preferir la observación real (OpenWeather current) sobre la previsión
      // AEMET, para que el texto coincida con icono/temperatura (también
      // observación) y con el `tiempoActual` del detalle. La descripción de la
      // observación AEMET es sintética (temp/humedad), por eso solo se confía en
      // OpenWeather; si no, se cae a la previsión.
      descripcionClima:
        (r.weather?.source === 'OpenWeather' ? r.weather.description : null) ??
        r.enrichment?.summary ??
        r.weather?.description ??
        null,
      iconoClima: r.weather?.icon ?? null,
      vientoMs: r.weather?.windSpeedMs ?? null,
      // Solo se muestra la bandera si sigue vigente (dentro de horario/temporada
      // y con dato de hoy); si no, el color guardado no refleja lo que ondea.
      bandera:
        r.flag?.color && esBanderaVigente(r.flag, ahora)
          ? (FLAG_COLOR_ES[r.flag.color] ?? null)
          : null,
      puntuacion: r.score,
      razonRanking: r.reason,
      motivoBaja: r.downgradeReason ?? null,
      atributos: r.beach.attributes ?? null,
    };
  }
}

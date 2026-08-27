import { Beach } from '../../domain/entities/Beach';
import { Weather } from '../../domain/entities/Weather';
import { FlagStatus } from '../../domain/entities/Flag';
import {
  ForecastEnrichment,
  ScoreCap,
  SubScores,
  SUBSCORE_MAX,
} from '../../domain/use-cases/BeachScorer';
import type { OutlookSignal } from '../../domain/use-cases/WeatherOutlook';
import type { DayWindowSignal } from '../../domain/use-cases/BeachWindowScorer';
import { FeaturedBeachDTO, FeaturedBeachesResponseDTO, VentanaDiaDTO } from '../dtos/FeaturedBeachDTO';
import { esBanderaVigente } from '../../domain/services/flagVigencia';
import { RainNowcast } from '../../domain/entities/RainNowcast';
import { LegacyDetailsMapper } from './LegacyDetailsMapper';

export interface FeaturedBeachResult {
  beach: Beach;
  weather: Weather | null;
  flag: FlagStatus | null;
  score: number;
  reason: string;
  downgradeReason: string | null;
  enrichment: ForecastEnrichment | null;
  /** Breakdown behind `score`. Absent on the excluded path, which never scores. */
  subScores?: SubScores | null;
  outlook?: OutlookSignal | null;
  tope?: ScoreCap | null;
  topeValor?: number | null;
  /** Best stretch of the remaining beach window. Absent on the excluded path. */
  ventanaDia?: DayWindowSignal | null;
  /** Aggregated rain nowcast; the score already reads it, the DTO publishes it. */
  rain?: RainNowcast | null;
}

/** Epoch ms → ISO, the shape every instant already travels in the API. */
export function mapVentanaDia(ventana: DayWindowSignal | null | undefined): VentanaDiaDTO | null {
  if (!ventana) return null;
  return {
    inicio: new Date(ventana.mejor.inicio).toISOString(),
    fin: new Date(ventana.mejor.fin).toISOString(),
    cambio: ventana.cambio
      ? { desde: new Date(ventana.cambio.desde).toISOString(), causa: ventana.cambio.causa }
      : null,
    motivo: ventana.motivo,
    horasConsideradas: ventana.horasConsideradas,
  };
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
    // A single "now" for the whole response: it decides which flags are still current.
    const ahora = new Date(timestamp);
    return {
      timestamp,
      playas: mejores.map((r) => this.mapOne(r, ahora)),
      revisar: revisar.map((r) => this.mapOne(r, ahora)),
      resumenTodas: resumenTodas.map((r) => this.mapOne(r, ahora)),
      maximos: { ...SUBSCORE_MAX },
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
      // Prefer the real observation (OpenWeather current) over the AEMET
      // forecast, so the text matches the icon/temperature (also observation)
      // and the `tiempoActual` of the detail. The AEMET observation description
      // is synthetic (temp/humidity), which is why only OpenWeather is trusted;
      // otherwise it falls back to the forecast.
      descripcionClima:
        (r.weather?.source === 'OpenWeather' ? r.weather.description : null) ??
        r.enrichment?.summary ??
        r.weather?.description ??
        null,
      iconoClima: r.weather?.icon ?? null,
      vientoMs: r.weather?.windSpeedMs ?? null,
      // The flag is only shown if it is still current (within schedule/season
      // and with today's data); otherwise the stored color does not reflect
      // what is actually flying.
      bandera:
        r.flag?.color && esBanderaVigente(r.flag, ahora)
          ? (FLAG_COLOR_ES[r.flag.color] ?? null)
          : null,
      puntuacion: r.score,
      razonRanking: r.reason,
      motivoBaja: r.downgradeReason ?? null,
      atributos: r.beach.attributes ?? null,
      // The breakdown of the mark. An excluded beach carries none: it does not
      // go through the scoring, it is filtered out, and publishing zeros would
      // read as "it scored 0 everywhere" instead of "it was ruled out".
      subpuntuaciones: r.subScores
        ? {
            cielo: r.subScores.cielo,
            temperatura: r.subScores.temperatura,
            bandera: r.subScores.bandera,
            viento: r.subScores.viento,
            oleaje: r.subScores.oleaje,
            datos: r.subScores.datos,
          }
        : null,
      pronostico: r.outlook
        ? {
            direccion: r.outlook.direccion,
            delta: r.outlook.delta,
            causa: r.outlook.causa ?? null,
          }
        : null,
      topeAplicado: r.tope ?? null,
      topeValor: r.topeValor ?? null,
      ventanaDia: mapVentanaDia(r.ventanaDia),
      oleaje: r.enrichment?.waves ?? null,
      lluvia: r.rain ? LegacyDetailsMapper.mapLluvia(r.rain) : null,
    };
  }
}

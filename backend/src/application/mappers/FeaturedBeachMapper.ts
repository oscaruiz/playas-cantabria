import { SUBSCORE_MAX } from '../../domain/use-cases/BeachScorer';
import type { DayWindowSignal } from '../../domain/use-cases/BeachWindowScorer';
import type { FeaturedBeachResult } from '../../domain/use-cases/BeachAssessment';
import { observedSky } from '../../domain/services/skySources';
import { FeaturedBeachDTO, FeaturedBeachesResponseDTO, VentanaDiaDTO } from '../../contract/api';
import { esBanderaVigente } from '../../domain/services/flagVigencia';
import { DetailsMapper } from './DetailsMapper';

export type { FeaturedBeachResult };

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

/** The flag as flying at `ahora`, judged when served and not when assembled. */
function flagShown(flag: FeaturedBeachResult['flag'] | undefined, ahora: Date): FeaturedBeachDTO['bandera'] {
  return flag?.color && esBanderaVigente(flag, ahora) ? (FLAG_COLOR_ES[flag.color] ?? null) : null;
}

export class FeaturedBeachMapper {
  /**
   * The two instants are NOT the same one, and merging them back would be a
   * safety bug, not a tidy-up:
   *
   * - `generadoEn` is when the ranking was assembled, and it is what gets
   *   published as `timestamp` so the app can tell how old the sky it is
   *   painting really is.
   * - `ahora` is when this response is being built, and it is what decides
   *   whether each flag is still current. Judging an hour-old ranking against
   *   its own assembly instant would republish lifeguard flags that expired
   *   fifty minutes ago as if they still applied.
   */
  static toDTO(
    mejores: FeaturedBeachResult[],
    revisar: FeaturedBeachResult[],
    resumenTodas: FeaturedBeachResult[],
    generadoEn: number,
    ahoraMs: number = Date.now(),
  ): FeaturedBeachesResponseDTO {
    const ahora = new Date(ahoraMs);
    return {
      timestamp: generadoEn,
      servidoEn: ahoraMs,
      playas: mejores.map((r) => this.mapOne(r, ahora)),
      revisar: revisar.map((r) => this.mapOne(r, ahora)),
      resumenTodas: resumenTodas.map((r) => this.mapOne(r, ahora)),
      maximos: { ...SUBSCORE_MAX },
    };
  }

  private static mapOne(r: FeaturedBeachResult, ahora: Date): FeaturedBeachDTO {
    const sky = observedSky(r.weather) ?? r.enrichment?.summary ?? r.weather?.description ?? null;
    return {
      nombre: r.beach.name,
      municipio: r.beach.municipality,
      codigo: r.beach.aemetCode,
      lat: r.beach.latitude,
      lon: r.beach.longitude,
      temperatura: r.weather?.temperatureC ?? r.enrichment?.temperatureC ?? null,
      // The sky observed now (OpenWeather, or Open-Meteo standing in) over
      // AEMET's forecast, so the text matches the icon/temperature and the
      // `tiempoActual` of the detail; otherwise the forecast, labelled as one.
      descripcionClima: sky,
      ...(sky != null && observedSky(r.weather) == null ? { climaPrevisto: true } : {}),
      iconoClima: r.weather?.icon ?? null,
      vientoMs: r.weather?.windSpeedMs ?? null,
      // The flag is only shown if it is still current (within schedule/season
      // and with today's data); otherwise the stored color does not reflect
      // what is actually flying.
      bandera: flagShown(r.rawFlag !== undefined ? r.rawFlag : r.flag, ahora),
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
      lluvia: r.rain ? DetailsMapper.mapLluvia(r.rain) : null,
    };
  }
}

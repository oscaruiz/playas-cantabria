import { Weather } from '../entities/Weather';
import {
  PrecipitationNow,
  RainNowcast,
  RainSourceSignal,
  RainUpcoming,
} from '../entities/RainNowcast';
import { WeatherProvider } from '../ports/WeatherProvider';
import { PrecipitationNowProvider } from '../ports/PrecipitationNowProvider';
import { InMemoryCache } from '../../infrastructure/cache/InMemoryCache';
import { Config } from '../../infrastructure/config/config';

// ---------------------------------------------------------------------------
// Detección por fuente (helpers puros, exportados para test)
// ---------------------------------------------------------------------------

/** Códigos OpenWeather que indican precipitación activa: 2xx tormenta,
 *  3xx llovizna, 5xx lluvia (6xx nieve no aplica a "lluvia" pero también
 *  es precipitación y arruina el día de playa igual). */
export function isOpenWeatherPrecipitating(w: Weather): boolean {
  const code = w.conditionCode ?? null;
  if (code != null && code >= 200 && code < 700) return true;
  return (w.precipitationMm ?? 0) > 0;
}

/** Códigos WMO de precipitación activa: 51-67 llovizna/lluvia,
 *  71-77/85-86 nieve, 80-82 chubascos, 95-99 tormenta. */
export const WMO_PRECIP = (code: number): boolean =>
  (code >= 51 && code <= 67) ||
  (code >= 71 && code <= 77) ||
  (code >= 80 && code <= 86) ||
  (code >= 95 && code <= 99);

export function isOpenMeteoPrecipitating(p: PrecipitationNow): boolean {
  if ((p.precipitationMm ?? 0) > 0) return true;
  if ((p.rainMm ?? 0) > 0) return true;
  if ((p.showersMm ?? 0) > 0) return true;
  return p.weatherCode != null && WMO_PRECIP(p.weatherCode);
}

/** El pluviómetro AEMET reporta acumulado de la última hora: señal real
 *  pero retardada (publica con ~1h de desfase). */
export function isAemetPrecipitating(w: Weather): boolean {
  return (w.precipitationMm ?? 0) > 0;
}

/**
 * Previsión de precipitación en los tramos minutely_15 de Open-Meteo.
 * Devuelve null si la fuente no trajo tramos (payload antiguo o incompleto).
 */
export function computeUpcoming(p: PrecipitationNow): RainUpcoming | null {
  const slots = p.upcomingSlots;
  if (!slots || slots.length === 0) return null;

  const precipitating = slots.filter(
    (s) =>
      (s.precipitationMm ?? 0) > 0 ||
      (s.weatherCode != null && WMO_PRECIP(s.weatherCode)),
  );

  if (precipitating.length === 0) {
    return { expected: false, firstAt: null, mmMax: null };
  }

  const mmValues = precipitating
    .map((s) => s.precipitationMm)
    .filter((v): v is number => typeof v === 'number' && v > 0);

  return {
    expected: true,
    firstAt: precipitating[0].timestamp,
    mmMax: mmValues.length > 0 ? Math.max(...mmValues) : null,
  };
}

// ---------------------------------------------------------------------------
// Caso de uso
// ---------------------------------------------------------------------------

/**
 * Agrega la señal "¿está lloviendo ahora?" de tres fuentes gratuitas.
 * Regla: `raining` si CUALQUIER fuente detecta precipitación activa;
 * `dry` si al menos una respondió y ninguna detecta; `unknown` solo si
 * fallan todas. Una fuente caída nunca rompe (allSettled).
 *
 * Cacheado por coordenadas para que detalle y destacadas compartan
 * resultado (las llamadas subyacentes ya están cacheadas además).
 */
export class GetRainNowcast {
  constructor(
    private readonly openWeather: WeatherProvider,
    private readonly aemet: WeatherProvider,
    private readonly openMeteo: PrecipitationNowProvider,
    private readonly cache: InMemoryCache,
  ) {}

  async execute(lat: number, lon: number): Promise<RainNowcast> {
    const ttl = Config.cacheTtlSeconds();
    const cacheKey = `rain:now:${lat.toFixed(4)},${lon.toFixed(4)}`;

    return this.cache.getOrSet(cacheKey, ttl, async () => {
      const [ow, aemet, om] = await Promise.allSettled([
        this.openWeather.getCurrentByCoords(lat, lon),
        this.aemet.getCurrentByCoords(lat, lon),
        this.openMeteo.getPrecipitationNow(lat, lon),
      ]);

      const sources: RainSourceSignal[] = [];

      if (ow.status === 'fulfilled') {
        sources.push({
          source: 'OpenWeather',
          precipitating: isOpenWeatherPrecipitating(ow.value),
          precipitationMm: ow.value.precipitationMm ?? null,
          lastHour: false,
          timestamp: ow.value.timestamp,
        });
      }

      if (aemet.status === 'fulfilled') {
        sources.push({
          source: 'AEMET',
          precipitating: isAemetPrecipitating(aemet.value),
          precipitationMm: aemet.value.precipitationMm ?? null,
          lastHour: true,
          timestamp: aemet.value.timestamp,
        });
      }

      if (om.status === 'fulfilled') {
        sources.push({
          source: 'OpenMeteo',
          precipitating: isOpenMeteoPrecipitating(om.value),
          precipitationMm: om.value.precipitationMm ?? null,
          lastHour: false,
          timestamp: om.value.timestamp,
        });
      }

      const precipitating = sources.filter((s) => s.precipitating);
      const status =
        sources.length === 0 ? 'unknown' : precipitating.length > 0 ? 'raining' : 'dry';

      const mmValues = sources
        .map((s) => s.precipitationMm)
        .filter((v): v is number => typeof v === 'number');

      const nowcast: RainNowcast = {
        status,
        precipitationMm: mmValues.length > 0 ? Math.max(...mmValues) : null,
        lastHourOnly:
          status === 'raining' && precipitating.every((s) => s.lastHour),
        sources,
        timestamp: Date.now(),
        upcoming: om.status === 'fulfilled' ? computeUpcoming(om.value) : null,
      };

      return nowcast;
    });
  }
}

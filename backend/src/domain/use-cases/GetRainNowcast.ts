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
// Per-source detection (pure helpers, exported for test)
// ---------------------------------------------------------------------------

/** OpenWeather codes indicating active precipitation: 2xx storm,
 *  3xx drizzle, 5xx rain (6xx snow does not apply to "rain" but is also
 *  precipitation and ruins the beach day all the same). */
export function isOpenWeatherPrecipitating(w: Weather): boolean {
  const code = w.conditionCode ?? null;
  if (code != null && code >= 200 && code < 700) return true;
  return (w.precipitationMm ?? 0) > 0;
}

/** WMO codes for active precipitation: 51-67 drizzle/rain,
 *  71-77/85-86 snow, 80-82 showers, 95-99 storm. */
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

/** The AEMET rain gauge reports the accumulation over the last hour: a real
 *  but delayed signal (published with ~1h lag). */
export function isAemetPrecipitating(w: Weather): boolean {
  return (w.precipitationMm ?? 0) > 0;
}

/**
 * Precipitation forecast from Open-Meteo's minutely_15 slots.
 * Returns null if the source brought no slots (old or incomplete payload).
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
// Use case
// ---------------------------------------------------------------------------

/**
 * Aggregates the "is it raining now?" signal from three free sources.
 * Rule: `raining` if ANY source detects active precipitation;
 * `dry` if at least one responded and none detects it; `unknown` only if
 * all of them fail. A source being down never breaks anything (allSettled).
 *
 * Cached by coordinates so that detail and featured share the result
 * (the underlying calls are cached as well).
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
        uvIndexMax: om.status === 'fulfilled' ? om.value.uvIndexMax ?? null : null,
        // Travels with the nowcast because it comes in the same request. Null
        // when Open-Meteo fails: then the score simply has no outlook to apply.
        outlook: om.status === 'fulfilled' ? om.value.upcomingHours ?? null : null,
      };

      return nowcast;
    });
  }
}

import { Weather } from '../../domain/entities/Weather';
import { ProviderError, WeatherProvider } from '../../domain/ports/WeatherProvider';
import { http } from '../http/axiosClient';
import { InMemoryCache, CacheKeys } from '../cache/InMemoryCache';
import { Config } from '../config/config';

/**
 * AEMET provider:
 * - Uses coords; in practice you may need to hit the "observacionconvencional" or "prediccion/especifica/playa" endpoints.
 * - This implementation focuses on shape + error handling + caching. Adjust endpoint parsing to your current AEMET integration.
 */
export class AemetWeatherProvider implements WeatherProvider {
  private lastRaw: unknown = null;

  constructor(private readonly cache: InMemoryCache) {}

  getLastRaw() {
    return this.lastRaw;
  }

  async getCurrentByCoords(lat: number, lon: number): Promise<Weather> {
    const cfg = Config.get();
    if (!cfg.aemetApiKey) {
      throw new ProviderError('AEMET', 'Missing AEMET API key');
    }
    const cacheKey = CacheKeys.weatherByCoords(lat, lon, 'AEMET');
    return this.cache.getOrSet(cacheKey, cfg.cacheTtlSeconds, async () => {
      try {
        const meta = await http.get('https://opendata.aemet.es/opendata/api/observacion/convencional/todas', {
          params: { api_key: cfg.aemetApiKey },
          timeout: 7000
        });
        debugLog('aemet.meta', meta.data);

        const datosUrl: string | undefined = meta.data?.datos;
        if (!datosUrl) {
          this.lastRaw = meta.data;
          throw new ProviderError('AEMET', 'Unexpected response: missing datos URL', 'BAD_PAYLOAD');
        }

        const obsResp = await http.get<AemetObs[]>(datosUrl, { timeout: 7000, responseType: 'json' });
        const arr = Array.isArray(obsResp.data) ? obsResp.data : [];
        this.lastRaw = arr;
        debugLog('aemet.obs', arr.slice(0, 5));

        if (arr.length === 0) {
          throw new ProviderError('AEMET', 'Empty observations payload', 'EMPTY');
        }

        let best: AemetObs | null = null;
        let bestD = Number.POSITIVE_INFINITY;
        for (const s of arr) {
          if (typeof s.lat !== 'number' || typeof s.lon !== 'number') continue;
          const d = haversineSq(lat, lon, s.lat, s.lon);
          if (d < bestD) {
            bestD = d;
            best = s;
          }
        }
        if (!best) {
          throw new ProviderError('AEMET', 'No station with coordinates found', 'NO_STATION');
        }

        const timestamp = best.fint ? parseAemetTime(best.fint) : Date.now();
        const pressure = typeof best.pres_nmar === 'number' ? best.pres_nmar : best.pres;

        const weather: Weather = {
          source: 'AEMET',
          timestamp,
          temperatureC: typeof best.ta === 'number' ? best.ta : null,
          description: null,
          icon: null,
          windSpeedMs: typeof best.vv === 'number' ? best.vv : null,
          windDirectionDeg: typeof best.dv === 'number' ? best.dv : null,
          humidityPct: typeof best.hr === 'number' ? best.hr : null,
          pressureHPa: typeof pressure === 'number' ? pressure : null
        };

        return weather;
      } catch (e: any) {
        const name = e?.code || e?.name;
        throw new ProviderError('AEMET', e?.message || 'AEMET request failed', name);
      }
    });
  }
}

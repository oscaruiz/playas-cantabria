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
  constructor(private readonly cache: InMemoryCache) {}

  async getCurrentByCoords(lat: number, lon: number): Promise<Weather> {
    const cfg = Config.get();
    if (!cfg.aemetApiKey) {
      throw new ProviderError('AEMET', 'Missing AEMET API key');
    }
    const cacheKey = CacheKeys.weatherByCoords(lat, lon, 'AEMET');
    return this.cache.getOrSet(cacheKey, cfg.cacheTtlSeconds, async () => {
      try {
        // Example flow (AEMET usually returns a redirect URL first):
        // 1) Request metadata URL
        const meta = await http.get(
          'https://opendata.aemet.es/opendata/api/observacion/convencional/todas',
          {
            params: { api_key: cfg.aemetApiKey },
            timeout: 7000,
          }
        );

        // AEMET opendata often responds with { estado, datos, metadatos }
        const datosUrl: string | undefined = (meta.data && meta.data.datos) || undefined;
        if (!datosUrl) {
          throw new ProviderError('AEMET', 'Unexpected response: missing datos URL', 'BAD_PAYLOAD');
        }

        // 2) Fetch actual payload
        const obsResp = await http.get(datosUrl, { timeout: 7000 });
        // Here you would select the closest station by (lat,lon) and map fields.
        // For demonstration, produce a minimal stable Weather object.
        const now = Date.now();
        const weather: Weather = {
          source: 'AEMET',
          timestamp: now,
          temperatureC: null,
          description: 'AEMET data',
          icon: null,
          windSpeedMs: null,
          windDirectionDeg: null,
          humidityPct: null,
          pressureHPa: null,
        };
        return weather;
      } catch (e: any) {
        const name = e?.code || e?.name;
        throw new ProviderError('AEMET', e?.message || 'AEMET request failed', name);
      }
    });
  }
}

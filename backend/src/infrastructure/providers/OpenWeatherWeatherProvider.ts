import { Weather } from '../../domain/entities/Weather';
import { ProviderError, WeatherProvider } from '../../domain/ports/WeatherProvider';
import { http } from '../http/axiosClient';
import { InMemoryCache, CacheKeys } from '../cache/InMemoryCache';
import { Config } from '../config/config';

export class OpenWeatherWeatherProvider implements WeatherProvider {
  constructor(private readonly cache: InMemoryCache) {}

  async getCurrentByCoords(lat: number, lon: number): Promise<Weather> {
    const cfg = Config.get();
    if (!cfg.openWeatherApiKey) {
      throw new ProviderError('OpenWeather', 'Missing OpenWeather API key');
    }
    const cacheKey = CacheKeys.weatherByCoords(lat, lon, 'OpenWeather');
    return this.cache.getOrSet(cacheKey, cfg.cacheTtlSeconds, async () => {
      try {
        const resp = await http.get('https://api.openweathermap.org/data/2.5/weather', {
          params: {
            lat,
            lon,
            units: 'metric',
            appid: cfg.openWeatherApiKey,
          },
          timeout: 7000,
        });

        const d = resp.data;
        const weather: Weather = {
          source: 'OpenWeather',
          timestamp: (d.dt ? d.dt * 1000 : Date.now()) as number,
          temperatureC: d.main?.temp ?? null,
          description: Array.isArray(d.weather) && d.weather[0]?.description ? d.weather[0].description : null,
          icon: Array.isArray(d.weather) && d.weather[0]?.icon ? d.weather[0].icon : null,
          windSpeedMs: d.wind?.speed ?? null,
          windDirectionDeg: d.wind?.deg ?? null,
          humidityPct: d.main?.humidity ?? null,
          pressureHPa: d.main?.pressure ?? null,
        };

        return weather;
      } catch (e: any) {
        const name = e?.code || e?.name;
        throw new ProviderError('OpenWeather', e?.message || 'OpenWeather request failed', name);
      }
    });
  }
}

import { Weather } from '../../domain/entities/Weather';
import { ProviderError, WeatherProvider } from '../../domain/ports/WeatherProvider';
import { http } from '../http/axiosClient';
import { InMemoryCache, CacheKeys } from '../cache/InMemoryCache';
import { Config } from '../config/config';
import { debugLog } from '../utils/debug';

export class OpenWeatherWeatherProvider implements WeatherProvider {
  private lastRaw: unknown = null;

  constructor(private readonly cache: InMemoryCache) {}

  getLastRaw() {
    return this.lastRaw;
  }

  async getCurrentByCoords(lat: number, lon: number): Promise<Weather> {
    const cfg = Config.get();
    if (!cfg.openWeatherApiKey) throw new ProviderError('OpenWeather', 'Missing OpenWeather API key');
    const cacheKey = CacheKeys.weatherByCoords(lat, lon, 'OpenWeather');

    return this.cache.getOrSet(cacheKey, cfg.cacheTtlSeconds, async () => {
      try {
        const resp = await http.get('https://api.openweathermap.org/data/2.5/weather', {
          params: { lat, lon, units: 'metric', lang: 'es', appid: cfg.openWeatherApiKey },
          timeout: 7000
        });

        this.lastRaw = resp.data;
        debugLog('openweather.raw', resp.data);

        const d = resp.data;
        const w0 = Array.isArray(d.weather) ? d.weather[0] ?? {} : {};
        const weather: Weather = {
          source: 'OpenWeather',
          timestamp: typeof d.dt === 'number' ? d.dt * 1000 : Date.now(),
          temperatureC: d.main?.temp ?? null,
          description: w0.description ?? null,
          icon: w0.icon ?? null,
          windSpeedMs: d.wind?.speed ?? null,
          windDirectionDeg: d.wind?.deg ?? null,
          humidityPct: d.main?.humidity ?? null,
          pressureHPa: d.main?.pressure ?? null
        };

        return weather;
      } catch (e: any) {
        const name = e?.code || e?.name;
        throw new ProviderError('OpenWeather', e?.message || 'OpenWeather request failed', name);
      }
    });
  }

  async getTomorrowByCoords(lat: number, lon: number): Promise<Weather> {
    const cfg = Config.get();
    if (!cfg.openWeatherApiKey) throw new ProviderError('OpenWeather', 'Missing OpenWeather API key');

    const cacheKey = `ow:forecast:tomorrow:${lat.toFixed(4)},${lon.toFixed(4)}`;
    return this.cache.getOrSet(cacheKey, cfg.cacheTtlSeconds, async () => {
      try {
        const resp = await http.get('https://api.openweathermap.org/data/2.5/forecast', {
          params: { lat, lon, units: 'metric', lang: 'es', appid: cfg.openWeatherApiKey },
          timeout: 8000
        });

        const list: any[] = Array.isArray(resp.data?.list) ? resp.data.list : [];
        if (list.length === 0) throw new ProviderError('OpenWeather', 'Empty forecast list', 'EMPTY');

        const tzSec: number = resp.data?.city?.timezone ?? 0;
        const now = Date.now();
        const inLocal = (tMs: number) => new Date(tMs + tzSec * 1000);
        const todayLocal = inLocal(now);
        const y = todayLocal.getUTCFullYear();
        const m = todayLocal.getUTCMonth();
        const d = todayLocal.getUTCDate() + 1;

        const isTomorrow = (dt: number) => {
          const nd = inLocal(dt * 1000);
          return nd.getUTCFullYear() === y && nd.getUTCMonth() === m && nd.getUTCDate() === d;
        };

        const slots = list.filter((it) => typeof it.dt === 'number' && isTomorrow(it.dt));
        let chosen =
          slots.find((it) => {
            const h = inLocal(it.dt * 1000).getUTCHours();
            return h >= 11 && h <= 14;
          }) ?? slots[Math.floor(slots.length / 2)] ?? list[list.length - 1];

        const w0 = Array.isArray(chosen.weather) ? chosen.weather[0] ?? {} : {};
        const main = chosen.main ?? {};
        const wind = chosen.wind ?? {};

        const w: Weather = {
          source: 'OpenWeather',
          timestamp: typeof chosen.dt === 'number' ? chosen.dt * 1000 : Date.now(),
          temperatureC: main.temp ?? null,
          description: w0.description ?? null,
          icon: w0.icon ?? null,
          windSpeedMs: wind.speed ?? null,
          windDirectionDeg: wind.deg ?? null,
          humidityPct: main.humidity ?? null,
          pressureHPa: main.pressure ?? null
        };

        debugLog('openweather.forecast.chosen', {
          dt: chosen.dt,
          desc: w0.description,
          icon: w0.icon,
          temp: main.temp
        });

        return w;
      } catch (e: any) {
        const name = e?.code || e?.name;
        throw new ProviderError('OpenWeather', e?.message || 'OpenWeather forecast failed', name);
      }
    });
  }

  async getDailyUVIndex(lat: number, lon: number): Promise<{ today: number | null; tomorrow: number | null }> {
    const cfg = Config.get();
    if (!cfg.openWeatherApiKey) throw new ProviderError('OpenWeather', 'Missing OpenWeather API key');

    const cacheKey = `ow:onecall:uv:${lat.toFixed(4)},${lon.toFixed(4)}`;
    return this.cache.getOrSet(cacheKey, cfg.cacheTtlSeconds, async () => {
      try {
        const resp = await http.get('https://api.openweathermap.org/data/2.5/onecall', {
          params: {
            lat,
            lon,
            units: 'metric',
            exclude: 'minutely,hourly,alerts',
            appid: cfg.openWeatherApiKey
          },
          timeout: 8000
        });

        const daily: any[] = Array.isArray(resp.data?.daily) ? resp.data.daily : [];
        const todayUv = daily[0]?.uvi ?? null;
        const tomorrowUv = daily[1]?.uvi ?? null;
        debugLog('openweather.onecall.uv', { todayUv, tomorrowUv });
        return { today: todayUv, tomorrow: tomorrowUv };
      } catch (e: any) {
        const name = e?.code || e?.name;
        throw new ProviderError('OpenWeather', e?.message || 'OpenWeather onecall failed', name);
      }
    });
  }

  async getCloudinessTodayAndTomorrow(lat: number, lon: number): Promise<{ today: number | null; tomorrow: number | null }> {
    const cfg = Config.get();
    if (!cfg.openWeatherApiKey) throw new ProviderError('OpenWeather', 'Missing OpenWeather API key');

    const cacheKey = `ow:clouds:today-tomorrow:${lat.toFixed(4)},${lon.toFixed(4)}`;
    return this.cache.getOrSet(cacheKey, cfg.cacheTtlSeconds, async () => {
      try {
        const [current, forecast] = await Promise.all([
          http.get('https://api.openweathermap.org/data/2.5/weather', {
            params: { lat, lon, units: 'metric', lang: 'es', appid: cfg.openWeatherApiKey },
            timeout: 7000
          }),
          http.get('https://api.openweathermap.org/data/2.5/forecast', {
            params: { lat, lon, units: 'metric', lang: 'es', appid: cfg.openWeatherApiKey },
            timeout: 8000
          })
        ]);

        const todayClouds: number | null = typeof current.data?.clouds?.all === 'number' ? current.data.clouds.all : null;

        const list: any[] = Array.isArray(forecast.data?.list) ? forecast.data.list : [];
        if (list.length === 0) return { today: todayClouds, tomorrow: null };
        const tzSec: number = forecast.data?.city?.timezone ?? 0;
        const now = Date.now();
        const inLocal = (tMs: number) => new Date(tMs + tzSec * 1000);
        const todayLocal = inLocal(now);
        const y = todayLocal.getUTCFullYear();
        const m = todayLocal.getUTCMonth();
        const d = todayLocal.getUTCDate() + 1;
        const isTomorrow = (dt: number) => {
          const nd = inLocal(dt * 1000);
          return nd.getUTCFullYear() === y && nd.getUTCMonth() === m && nd.getUTCDate() === d;
        };
        const slots = list.filter((it) => typeof it.dt === 'number' && isTomorrow(it.dt));
        const chosen =
          slots.find((it) => {
            const h = inLocal(it.dt * 1000).getUTCHours();
            return h >= 11 && h <= 14;
          }) ?? slots[Math.floor(slots.length / 2)] ?? list[list.length - 1];

        const tomorrowClouds: number | null = typeof chosen?.clouds?.all === 'number' ? chosen.clouds.all : null;
        return { today: todayClouds, tomorrow: tomorrowClouds };
      } catch (e: any) {
        const name = e?.code || e?.name;
        throw new ProviderError('OpenWeather', e?.message || 'OpenWeather clouds failed', name);
      }
    });
  }
}

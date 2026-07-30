import { Weather } from '../../domain/entities/Weather';
import { ProviderError, WeatherProvider } from '../../domain/ports/WeatherProvider';
import { http } from '../http/axiosClient';
import { InMemoryCache, CacheKeys } from '../cache/InMemoryCache';
import { Config } from '../config/config';
import { debugLog } from '../utils/debug';

/** Half day (morning or afternoon) of the OpenWeather forecast, to fill AEMET gaps. */
export type OwHalf = {
  descripcion: string | null;
  iconOw: string | null;
  vientoMs: number | null;
};

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

    // getOrSetStale: if OpenWeather goes down, the last good observation keeps
    // being served instead of leaving the page without weather, and nobody waits on the network.
    return this.cache.getOrSetStale(cacheKey, Config.providerTtlSeconds(), Config.providerStaleTtlSeconds(), async () => {
      try {
        const resp = await http.get('https://api.openweathermap.org/data/2.5/weather', {
          params: { lat, lon, units: 'metric', lang: 'es', appid: cfg.openWeatherApiKey },
          timeout: 7000
        });

        this.lastRaw = resp.data;
        debugLog('openweather.raw', resp.data);

        const d = resp.data;
        const w0 = Array.isArray(d.weather) ? d.weather[0] ?? {} : {};
        // Real precipitation volume (mm) reported by the current-weather endpoint.
        const precipMm = d.rain?.['1h'] ?? d.rain?.['3h'] ?? d.snow?.['1h'] ?? null;
        const weather: Weather = {
          source: 'OpenWeather',
          timestamp: typeof d.dt === 'number' ? d.dt * 1000 : Date.now(),
          temperatureC: d.main?.temp ?? null,
          description: w0.description ?? null,
          icon: w0.icon ?? null,
          precipitationMm: typeof precipMm === 'number' ? precipMm : null,
          conditionCode: typeof w0.id === 'number' ? w0.id : null,
          cloudinessPct: typeof d.clouds?.all === 'number' ? d.clouds.all : null,
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

  /**
   * Downloads (or retrieves from cache) the 5d/3h forecast ONCE per coordinates.
   *
   * There used to be three public methods hitting the SAME endpoint with three
   * different cache keys (tomorrow, half days, cloudiness): three calls
   * against the OpenWeather quota for the same payload. Now they all derive from here.
   */
  private async getForecastRaw(lat: number, lon: number): Promise<{ list: any[]; tzSec: number }> {
    const cfg = Config.get();
    if (!cfg.openWeatherApiKey) throw new ProviderError('OpenWeather', 'Missing OpenWeather API key');

    const cacheKey = `ow:forecast:${lat.toFixed(4)},${lon.toFixed(4)}`;
    // Forecast TTL, not observation TTL: the 5d/3h model updates every
    // few hours, so refreshing it at the nowcast rate was throwing quota away.
    return this.cache.getOrSetStale(cacheKey, Config.forecastTtlSeconds(), Config.forecastStaleTtlSeconds(), async () => {
      try {
        const resp = await http.get('https://api.openweathermap.org/data/2.5/forecast', {
          params: { lat, lon, units: 'metric', lang: 'es', appid: cfg.openWeatherApiKey },
          timeout: 8000
        });
        const list: any[] = Array.isArray(resp.data?.list) ? resp.data.list : [];
        return { list, tzSec: resp.data?.city?.timezone ?? 0 };
      } catch (e: any) {
        const name = e?.code || e?.name;
        throw new ProviderError('OpenWeather', e?.message || 'OpenWeather forecast failed', name);
      }
    });
  }

  /** Most representative forecast slot for tomorrow (midday if available). */
  private pickTomorrowSlot(list: any[], tzSec: number): any | undefined {
    const inLocal = (tMs: number) => new Date(tMs + tzSec * 1000);
    const todayLocal = inLocal(Date.now());
    const y = todayLocal.getUTCFullYear();
    const m = todayLocal.getUTCMonth();
    const d = todayLocal.getUTCDate() + 1;

    const isTomorrow = (dt: number) => {
      const nd = inLocal(dt * 1000);
      return nd.getUTCFullYear() === y && nd.getUTCMonth() === m && nd.getUTCDate() === d;
    };

    const slots = list.filter((it) => typeof it.dt === 'number' && isTomorrow(it.dt));
    return (
      slots.find((it) => {
        const h = inLocal(it.dt * 1000).getUTCHours();
        return h >= 11 && h <= 14;
      }) ??
      slots[Math.floor(slots.length / 2)] ??
      list[list.length - 1]
    );
  }

  async getTomorrowByCoords(lat: number, lon: number): Promise<Weather> {
    const { list, tzSec } = await this.getForecastRaw(lat, lon);
    if (list.length === 0) throw new ProviderError('OpenWeather', 'Empty forecast list', 'EMPTY');

    const chosen = this.pickTomorrowSlot(list, tzSec);
    if (!chosen) throw new ProviderError('OpenWeather', 'Empty forecast list', 'EMPTY');

    const w0 = Array.isArray(chosen.weather) ? chosen.weather[0] ?? {} : {};
    const main = chosen.main ?? {};
    const wind = chosen.wind ?? {};

    debugLog('openweather.forecast.chosen', {
      dt: chosen.dt,
      desc: w0.description,
      icon: w0.icon,
      temp: main.temp
    });

    return {
      source: 'OpenWeather',
      timestamp: typeof chosen.dt === 'number' ? chosen.dt * 1000 : Date.now(),
      temperatureC: main.temp ?? null,
      description: w0.description ?? null,
      icon: w0.icon ?? null,
      cloudinessPct: typeof chosen.clouds?.all === 'number' ? chosen.clouds.all : null,
      windSpeedMs: wind.speed ?? null,
      windDirectionDeg: wind.deg ?? null,
      humidityPct: main.humidity ?? null,
      pressureHPa: main.pressure ?? null
    };
  }

  /**
   * Forecast by HALF DAYS (morning/afternoon) for today and the coming days, from
   * the free 5d/3h forecast. Used to FILL IN the AEMET forecast when
   * it comes in incomplete ("nd" in sky/wind). Index 0 = today, 1 = tomorrow, ...
   */
  async getForecastHalfDays(
    lat: number,
    lon: number,
    days = 3
  ): Promise<Array<{ manana: OwHalf; tarde: OwHalf }>> {
    const { list, tzSec } = await this.getForecastRaw(lat, lon);
    const inLocal = (dtSec: number) => new Date(dtSec * 1000 + tzSec * 1000);
    const dayKey = (dtSec: number) => inLocal(dtSec).toISOString().slice(0, 10);

    // Group slots by local date
    const byDay = new Map<string, any[]>();
    for (const it of list) {
      if (typeof it.dt !== 'number') continue;
      const k = dayKey(it.dt);
      (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(it);
    }
    const keys = Array.from(byDay.keys()).sort().slice(0, days);

    const toHalf = (slot: any | undefined): OwHalf => {
      if (!slot) return { descripcion: null, iconOw: null, vientoMs: null };
      const w0 = Array.isArray(slot.weather) ? slot.weather[0] ?? {} : {};
      return {
        descripcion: w0.description ?? null,
        iconOw: w0.icon ?? null,
        vientoMs: slot.wind?.speed ?? null
      };
    };
    // Slot closest to a target hour within a [min,max) window.
    const pick = (slots: any[], target: number, min: number, max: number) => {
      const inWin = slots.filter((s) => {
        const h = inLocal(s.dt).getUTCHours();
        return h >= min && h < max;
      });
      const pool = inWin.length ? inWin : slots;
      return pool.reduce(
        (best, s) =>
          best == null || Math.abs(inLocal(s.dt).getUTCHours() - target) < Math.abs(inLocal(best.dt).getUTCHours() - target)
            ? s
            : best,
        null as any
      );
    };

    return keys.map((k) => {
      const slots = byDay.get(k)!;
      return { manana: toHalf(pick(slots, 11, 6, 14)), tarde: toHalf(pick(slots, 17, 14, 22)) };
    });
  }

  /**
   * @deprecated OpenWeather retired One Call 2.5: with new keys it responds 401,
   * so this call only spent quota and latency to always end up on the
   * estimation path. Real UV is now served by Open-Meteo (`uvIndexMax` from the
   * rain nowcast), free and keyless, inside a request that was already being made.
   * Kept with no callers because of the rule of not removing providers.
   */
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

  /**
   * Cloudiness today/tomorrow WITHOUT its own requests: today comes from the
   * current observation (already cached) and tomorrow from the shared forecast. It used
   * to make two new calls per beach to read a single field from each response.
   */
  async getCloudinessTodayAndTomorrow(lat: number, lon: number): Promise<{ today: number | null; tomorrow: number | null }> {
    const [current, forecast] = await Promise.allSettled([
      this.getCurrentByCoords(lat, lon),
      this.getForecastRaw(lat, lon)
    ]);

    const todayClouds =
      current.status === 'fulfilled' ? current.value.cloudinessPct ?? null : null;

    if (forecast.status !== 'fulfilled' || forecast.value.list.length === 0) {
      if (current.status === 'rejected' && forecast.status === 'rejected') {
        throw new ProviderError('OpenWeather', 'OpenWeather clouds failed');
      }
      return { today: todayClouds, tomorrow: null };
    }

    const chosen = this.pickTomorrowSlot(forecast.value.list, forecast.value.tzSec);
    return {
      today: todayClouds,
      tomorrow: typeof chosen?.clouds?.all === 'number' ? chosen.clouds.all : null
    };
  }
}

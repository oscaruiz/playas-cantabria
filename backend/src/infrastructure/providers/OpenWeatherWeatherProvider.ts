import { Weather } from '../../domain/entities/Weather';
import { ProviderError, WeatherProvider } from '../../domain/ports/WeatherProvider';
import { http } from '../http/axiosClient';
import { InMemoryCache, CacheKeys } from '../cache/InMemoryCache';
import { Config } from '../config/config';
import { debugLog } from '../utils/debug';

/** Medio día (mañana o tarde) de la previsión OpenWeather, para rellenar huecos de AEMET. */
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

    // getOrSetStale: si OpenWeather cae, se sigue sirviendo la última observación
    // buena en vez de dejar la ficha sin clima, y nadie espera a la red.
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
   * Descarga (o recupera de caché) el forecast 5d/3h UNA sola vez por coordenadas.
   *
   * Antes había tres métodos públicos que pegaban al MISMO endpoint con tres
   * claves de caché distintas (mañana, medios días, nubosidad): tres llamadas
   * a la cuota de OpenWeather para el mismo payload. Ahora todos derivan de aquí.
   */
  private async getForecastRaw(lat: number, lon: number): Promise<{ list: any[]; tzSec: number }> {
    const cfg = Config.get();
    if (!cfg.openWeatherApiKey) throw new ProviderError('OpenWeather', 'Missing OpenWeather API key');

    const cacheKey = `ow:forecast:${lat.toFixed(4)},${lon.toFixed(4)}`;
    // TTL de previsión, no de observación: el modelo 5d/3h se actualiza cada
    // pocas horas, así que refrescarlo al ritmo del nowcast era tirar cuota.
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

  /** Slot del forecast más representativo de mañana (mediodía si lo hay). */
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
   * Previsión por MEDIOS DÍAS (mañana/tarde) para hoy y los próximos días, a partir
   * del forecast gratuito 5d/3h. Se usa para RELLENAR la previsión de AEMET cuando
   * ésta viene incompleta ("nd" en cielo/viento). Índice 0 = hoy, 1 = mañana, ...
   */
  async getForecastHalfDays(
    lat: number,
    lon: number,
    days = 3
  ): Promise<Array<{ manana: OwHalf; tarde: OwHalf }>> {
    const { list, tzSec } = await this.getForecastRaw(lat, lon);
    const inLocal = (dtSec: number) => new Date(dtSec * 1000 + tzSec * 1000);
    const dayKey = (dtSec: number) => inLocal(dtSec).toISOString().slice(0, 10);

    // Agrupar slots por fecha local
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
    // Slot más cercano a una hora objetivo dentro de una ventana [min,max).
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
   * @deprecated OpenWeather retiró One Call 2.5: con claves nuevas responde 401,
   * así que esta llamada solo gastaba cuota y latencia para acabar siempre en el
   * camino de estimación. El UV real lo sirve ahora Open-Meteo (`uvIndexMax` del
   * nowcast de lluvia), gratis y sin clave, dentro de una petición que ya se hacía.
   * Se conserva sin llamantes por la regla de no eliminar proveedores.
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
   * Nubosidad hoy/mañana SIN peticiones propias: hoy sale de la observación
   * actual (ya cacheada) y mañana del forecast compartido. Antes hacía dos
   * llamadas nuevas por playa para leer un único campo de cada respuesta.
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

import { PrecipitationNow, PrecipitationSlot } from '../../domain/entities/RainNowcast';
import { PrecipitationNowProvider } from '../../domain/ports/PrecipitationNowProvider';
import { ProviderError } from '../../domain/ports/WeatherProvider';
import { http } from '../http/axiosClient';
import { InMemoryCache } from '../cache/InMemoryCache';
import { Config } from '../config/config';
import { debugLog } from '../utils/debug';

/**
 * Precipitación actual desde Open-Meteo (https://open-meteo.com):
 * gratuito, sin API key (free tier ~10k llamadas/día; 46 playas × TTL 1800s
 * ≈ 2,2k/día, y menos aún fuera de la franja de playa por el `ttlFactor`).
 * OJO: bajar CACHE_TTL_SECONDS a 300 dispararía el consumo a ~13k/día y
 * rompería la cuota. Complementa a OpenWeather para detectar lluvia que
 * los modelos de un solo proveedor pierden (llovizna costera hiperlocal).
 */
export class OpenMeteoPrecipitationProvider implements PrecipitationNowProvider {
  private lastRaw: unknown = null;

  constructor(private readonly cache: InMemoryCache) {}

  getLastRaw() {
    return this.lastRaw;
  }

  async getPrecipitationNow(lat: number, lon: number): Promise<PrecipitationNow> {
    const cacheKey = `openmeteo:now:${lat.toFixed(4)},${lon.toFixed(4)}`;

    return this.cache.getOrSetStale(cacheKey, Config.providerTtlSeconds(), Config.providerStaleTtlSeconds(), async () => {
      try {
        const resp = await http.get('https://api.open-meteo.com/v1/forecast', {
          params: {
            latitude: lat,
            longitude: lon,
            current: 'precipitation,rain,showers,weather_code',
            // Previsión próximas 6h (24 tramos de 15 min) en la MISMA llamada.
            minutely_15: 'precipitation,weather_code',
            forecast_minutely_15: 24,
            // UV máximo de hoy y mañana, también en la misma llamada (coste 0):
            // sustituye a OpenWeather One Call 2.5, que está retirado.
            daily: 'uv_index_max',
            forecast_days: 2,
            timezone: 'UTC'
          },
          timeout: 7000
        });

        this.lastRaw = resp.data;
        debugLog('openmeteo.raw', resp.data);

        const c = resp.data?.current ?? {};
        const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
        // Los ISO de Open-Meteo llegan sin zona ("2026-07-15T19:00") en UTC.
        const parseUtc = (iso: unknown): number | null => {
          if (typeof iso !== 'string') return null;
          const parsed = Date.parse(iso.endsWith('Z') ? iso : `${iso}Z`);
          return Number.isNaN(parsed) ? null : parsed;
        };

        const timestamp = parseUtc(c.time) ?? Date.now();

        const m = resp.data?.minutely_15 ?? {};
        const times: unknown[] = Array.isArray(m.time) ? m.time : [];
        const precs: unknown[] = Array.isArray(m.precipitation) ? m.precipitation : [];
        const codes: unknown[] = Array.isArray(m.weather_code) ? m.weather_code : [];
        const upcomingSlots: PrecipitationSlot[] = [];
        for (let i = 0; i < times.length; i++) {
          const ts = parseUtc(times[i]);
          if (ts == null) continue;
          upcomingSlots.push({
            timestamp: ts,
            precipitationMm: num(precs[i]),
            weatherCode: num(codes[i])
          });
        }

        // `timezone: UTC` hace que los días de `daily` sean días UTC. En España
        // (UTC+1/+2) solo divergen las primeras horas de la madrugada, cuando el
        // UV es 0 e irrelevante para una ficha de playa.
        const uv: unknown[] = Array.isArray(resp.data?.daily?.uv_index_max)
          ? resp.data.daily.uv_index_max
          : [];

        const now: PrecipitationNow = {
          source: 'OpenMeteo',
          timestamp,
          precipitationMm: num(c.precipitation),
          rainMm: num(c.rain),
          showersMm: num(c.showers),
          weatherCode: num(c.weather_code),
          upcomingSlots,
          uvIndexMax: uv.length > 0 ? { today: num(uv[0]), tomorrow: num(uv[1]) } : null
        };

        return now;
      } catch (e: any) {
        const name = e?.code || e?.name;
        throw new ProviderError('OpenMeteo', e?.message || 'Open-Meteo request failed', name);
      }
    });
  }
}

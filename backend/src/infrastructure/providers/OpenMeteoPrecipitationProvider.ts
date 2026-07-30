import { PrecipitationNow, PrecipitationSlot } from '../../domain/entities/RainNowcast';
import { PrecipitationNowProvider } from '../../domain/ports/PrecipitationNowProvider';
import { ProviderError } from '../../domain/ports/WeatherProvider';
import { http } from '../http/axiosClient';
import { InMemoryCache } from '../cache/InMemoryCache';
import { Config } from '../config/config';
import { debugLog } from '../utils/debug';

/**
 * Current precipitation from Open-Meteo (https://open-meteo.com):
 * free, no API key (free tier ~10k calls/day; 46 beaches × TTL 1800s
 * ≈ 2.2k/day, and even less outside the beach window thanks to the `ttlFactor`).
 * WARNING: lowering CACHE_TTL_SECONDS to 300 would shoot consumption up to ~13k/day and
 * break the quota. Complements OpenWeather to detect rain that
 * single-provider models miss (hyperlocal coastal drizzle).
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
            // Forecast for the next 6h (24 slots of 15 min) in the SAME call.
            minutely_15: 'precipitation,weather_code',
            forecast_minutely_15: 24,
            // Max UV for today and tomorrow, also in the same call (cost 0):
            // replaces OpenWeather One Call 2.5, which is retired.
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
        // Open-Meteo's ISO strings arrive without zone ("2026-07-15T19:00") in UTC.
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

        // `timezone: UTC` makes the `daily` days be UTC days. In Spain
        // (UTC+1/+2) they only diverge during the first hours after midnight, when
        // UV is 0 and irrelevant for a beach page.
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

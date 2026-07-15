import { PrecipitationNow, PrecipitationSlot } from '../../domain/entities/RainNowcast';
import { PrecipitationNowProvider } from '../../domain/ports/PrecipitationNowProvider';
import { ProviderError } from '../../domain/ports/WeatherProvider';
import { http } from '../http/axiosClient';
import { InMemoryCache } from '../cache/InMemoryCache';
import { Config } from '../config/config';
import { debugLog } from '../utils/debug';

/**
 * Precipitación actual desde Open-Meteo (https://open-meteo.com):
 * gratuito, sin API key (free tier ~10k llamadas/día; 20 playas × TTL 300s
 * ≈ 5,8k/día máximo). Complementa a OpenWeather para detectar lluvia que
 * los modelos de un solo proveedor pierden (llovizna costera hiperlocal).
 */
export class OpenMeteoPrecipitationProvider implements PrecipitationNowProvider {
  private lastRaw: unknown = null;

  constructor(private readonly cache: InMemoryCache) {}

  getLastRaw() {
    return this.lastRaw;
  }

  async getPrecipitationNow(lat: number, lon: number): Promise<PrecipitationNow> {
    const cfg = Config.get();
    const cacheKey = `openmeteo:now:${lat.toFixed(4)},${lon.toFixed(4)}`;

    return this.cache.getOrSet(cacheKey, cfg.cacheTtlSeconds, async () => {
      try {
        const resp = await http.get('https://api.open-meteo.com/v1/forecast', {
          params: {
            latitude: lat,
            longitude: lon,
            current: 'precipitation,rain,showers,weather_code',
            // Previsión próximas 6h (24 tramos de 15 min) en la MISMA llamada.
            minutely_15: 'precipitation,weather_code',
            forecast_minutely_15: 24,
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

        const now: PrecipitationNow = {
          source: 'OpenMeteo',
          timestamp,
          precipitationMm: num(c.precipitation),
          rainMm: num(c.rain),
          showersMm: num(c.showers),
          weatherCode: num(c.weather_code),
          upcomingSlots
        };

        return now;
      } catch (e: any) {
        const name = e?.code || e?.name;
        throw new ProviderError('OpenMeteo', e?.message || 'Open-Meteo request failed', name);
      }
    });
  }
}

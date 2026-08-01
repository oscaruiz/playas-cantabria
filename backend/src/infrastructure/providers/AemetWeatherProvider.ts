import { Weather } from '../../domain/entities/Weather';
import { SunshineObservation } from '../../domain/entities/Sunshine';
import { ProviderError, WeatherProvider } from '../../domain/ports/WeatherProvider';
import { SunshineProvider } from '../../domain/ports/SunshineProvider';
import { http } from '../http/axiosClient';
import { InMemoryCache, CacheKeys } from '../cache/InMemoryCache';
import { Config } from '../config/config';
import { debugLog } from '../utils/debug';
import type { RegionBbox } from '../../regions';

// 🌤️ AEMET TYPES
interface AemetObs {
  idema?: string;    // Station ID
  lat?: number;      // Latitude
  lon?: number;      // Longitude
  fint?: string;     // "2025-08-13T12:00:00+0000"
  ta?: number;       // 🌡️ Ambient temperature (°C)
  hr?: number;       // 💧 Relative humidity (%)
  pres?: number;     // 📊 Pressure (hPa)
  pres_nmar?: number; // 📊 Sea-level pressure (hPa)
  vv?: number;       // 👁️ Visibility (km) - NOT wind speed
  dv?: number;       // 🧭 Wind direction (degrees)
  vmax?: number;     // 💨 Maximum wind speed (m/s)
  prec?: number;     // 🌧️ Precipitation last hour (mm)
  inso?: number;     // ☀️ Insolation: MINUTES of sun in the last hour (0-60)
  ubi?: string;      // 📍 Location
}

// 🧮 HAVERSINE FORMULA (distance between coordinates)
function haversineSq(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Keeps observations that fall inside at least one loaded region. This is an
 * exact union rather than a large envelope, so distant regions do not retain
 * every station between them.
 */
export function isInsideObservationBboxes(
  lat: unknown,
  lon: unknown,
  bboxes: RegionBbox[],
): boolean {
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  return bboxes.some((bbox) =>
    lat >= bbox.latMin &&
    lat <= bbox.latMax &&
    lon >= bbox.lonMin &&
    lon <= bbox.lonMax
  );
}

/**
 * `inso` is MINUTES of sun in the last hour. The range is validated at the
 * parsing boundary, not further in: if AEMET changed the unit (to hours, or to
 * a percentage) the values would stop falling in [0, 60] and we prefer going
 * without correction over degrading the sky with a scale that is no longer ours.
 */
function esInsolacionUsable(inso: unknown): inso is number {
  return typeof inso === 'number' && Number.isFinite(inso) && inso >= 0 && inso <= 60;
}

// ⏰ AEMET TIME PARSER
function parseAemetTime(fint: string): number {
  try {
    return new Date(fint).getTime();
  } catch {
    return Date.now();
  }
}

/**
 * AEMET provider:
 * - Uses coords; in practice you may need to hit the "observacionconvencional" or "prediccion/especifica/playa" endpoints.
 * - This implementation focuses on shape + error handling + caching. Adjust endpoint parsing to your current AEMET integration.
 */
export class AemetWeatherProvider implements WeatherProvider, SunshineProvider {
  private lastRaw: unknown = null;
  private readonly observationsCacheKey: string;

  constructor(
    private readonly cache: InMemoryCache,
    private readonly observationBboxes: RegionBbox[],
  ) {
    const bboxFingerprint = observationBboxes
      .map((bbox) => [bbox.latMin, bbox.latMax, bbox.lonMin, bbox.lonMax].join(','))
      .sort()
      .join('|');
    this.observationsCacheKey = `aemet:obs:${bboxFingerprint}`;
  }

  getLastRaw() {
    return this.lastRaw;
  }

  /**
   * Observed insolation from the closest useful station.
   *
   * "Useful" excludes most of them: of the ~69 stations of the Cantabrian arc only
   * about 9 publish `inso`, and none on the eastern coast (Castro-EDAR and Treto
   * exist but do not measure it). That is why the station chosen by
   * `getCurrentByCoords` cannot be reused: the closest one is almost never one
   * of those that measure sun.
   *
   * Does not throw: without a candidate it returns null and the caller keeps its data.
   */
  async getSunshineNear(lat: number, lon: number): Promise<SunshineObservation[]> {
    try {
      const arr = await this.getObservacionesCached();
      if (arr.length === 0) return [];

      // The payload carries several rows per station (last hours). We keep
      // the most recent of each one that also carries `inso` in range: a
      // freshly published row can come in incomplete.
      const porEstacion = new Map<string, AemetObs>();
      for (const s of arr) {
        if (!s.idema || typeof s.lat !== 'number' || typeof s.lon !== 'number') continue;
        if (!esInsolacionUsable(s.inso)) continue;
        const previa = porEstacion.get(s.idema);
        if (!previa || (s.fint ?? '') > (previa.fint ?? '')) porEstacion.set(s.idema, s);
      }
      if (porEstacion.size === 0) return [];

      // Only the 3 closest: the first one decides and the others serve as witnesses.
      // Returning all nine of the Cantabrian arc adds nothing and enlarges the object
      // that ends up in the diagnostic.
      return [...porEstacion.values()]
        .map((s) => {
          const insoMin = s.inso as number;
          return {
            insoMin,
            fraccion: insoMin / 60,
            distanciaKm: haversineSq(lat, lon, s.lat!, s.lon!),
            idema: s.idema as string,
            ubicacion: s.ubi ?? null,
            observadoEn: s.fint ? parseAemetTime(s.fint) : Date.now(),
          };
        })
        .sort((a, b) => a.distanciaKm - b.distanciaKm)
        .slice(0, 3);
    } catch {
      return [];
    }
  }

  async getCurrentByCoords(lat: number, lon: number): Promise<Weather> {
    const cfg = Config.get();
    if (!cfg.aemetApiKey) {
      throw new ProviderError('AEMET', 'Missing AEMET API key');
    }
    const cacheKey = CacheKeys.weatherByCoords(lat, lon, 'AEMET');
    return this.cache.getOrSetStale(cacheKey, Config.providerTtlSeconds(), Config.providerStaleTtlSeconds(), async () => {
      try {
        const arr = await this.getObservacionesCached();

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

        // The payload carries several rows per station (last hours, different
        // fint). Sort the chosen station's rows from most recent to oldest
        // and take, per field, the first available numeric value
        // (the most recent row can come in incomplete).
        const rows = best.idema
          ? arr
              .filter((s) => s.idema === best!.idema)
              .sort((a, b) => (b.fint ?? '').localeCompare(a.fint ?? ''))
          : [best];
        const latest = rows[0] ?? best;
        const firstNumber = (pick: (o: AemetObs) => number | undefined): number | null => {
          for (const r of rows) {
            const v = pick(r);
            if (typeof v === 'number') return v;
          }
          return null;
        };

        const timestamp = latest.fint ? parseAemetTime(latest.fint) : Date.now();
        const pressure = firstNumber((o) => (typeof o.pres_nmar === 'number' ? o.pres_nmar : o.pres));

        const weather: Weather = {
          source: 'AEMET',
          timestamp,
          temperatureC: firstNumber((o) => o.ta),
          description: this.generateAemetDescription(latest),
          icon: this.generateAemetIcon(latest),
          // prec: only the most recent row (an old accumulation would give false "raining").
          precipitationMm: typeof latest.prec === 'number' ? latest.prec : null,
          windSpeedMs: firstNumber((o) => o.vmax), // ✅ FIXED: vmax is wind speed
          windDirectionDeg: firstNumber((o) => o.dv),
          humidityPct: firstNumber((o) => o.hr),
          pressureHPa: pressure
        };

        return weather;
      } catch (e: any) {
        const name = e?.code || e?.name;
        throw new ProviderError('AEMET', e?.message || 'AEMET request failed', name);
      }
    });
  }

  /**
   * Downloads (or retrieves from cache) the observations payload under a single
   * key: one download per TTL serves all beaches (previously each beach
   * re-downloaded the whole payload).
   *
   * It is TRIMMED to the active region before caching: AEMET returns all the
   * stations of Spain (tens of MB) and the process lives in 512 MB of RAM.
   */
  private async getObservacionesCached(): Promise<AemetObs[]> {
    const cfg = Config.get();
    return this.cache.getOrSetStale(this.observationsCacheKey, Config.providerTtlSeconds(), Config.providerStaleTtlSeconds(), async () => {
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
      const todas = Array.isArray(obsResp.data) ? obsResp.data : [];
      const arr = todas.filter((observation) =>
        isInsideObservationBboxes(
          observation.lat,
          observation.lon,
          this.observationBboxes,
        ),
      );
      this.lastRaw = arr;
      debugLog('aemet.obs', { totalEspana: todas.length, region: arr.length, muestra: arr.slice(0, 5) });
      // If trimming leaves the payload empty (unexpected format), better all than
      // none: the beach is left without AEMET data only if there truly is nothing.
      return arr.length > 0 ? arr : todas;
    });
  }

  /**
   * 📝 Generate description based on AEMET data
   */
  private generateAemetDescription(obs: AemetObs): string | null {
    const temp = obs.ta;
    const humidity = obs.hr;
    const pressure = obs.pres || obs.pres_nmar;
    
    if (typeof temp !== 'number') return null;
    
    let desc = '';

    // Temperature
    if (temp < 10) desc += 'Frío';
    else if (temp < 20) desc += 'Templado';
    else if (temp < 30) desc += 'Cálido';
    else desc += 'Muy cálido';
    
    // Humidity
    if (typeof humidity === 'number') {
      if (humidity > 80) desc += ' y húmedo';
      else if (humidity < 40) desc += ' y seco';
    }
    
    // Pressure (weather trend)
    if (typeof pressure === 'number') {
      if (pressure > 1020) desc += ', tiempo estable';
      else if (pressure < 1000) desc += ', tiempo inestable';
    }
    
    return desc || null;
  }

  /**
   * 🎨 Generate icon based on AEMET data
   */
  private generateAemetIcon(obs: AemetObs): string | null {
    const temp = obs.ta;
    const humidity = obs.hr;
    
    if (typeof temp !== 'number') return null;
    
    // Simple logic based on temperature and humidity
    if (typeof humidity === 'number' && humidity > 80) {
      return '04d'; // Cloudy/humid
    } else if (typeof humidity === 'number' && humidity < 40) {
      return '01d'; // Clear/dry
    } else {
      return '02d'; // Partly cloudy
    }
  }
}

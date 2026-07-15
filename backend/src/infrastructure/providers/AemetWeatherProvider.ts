import { Weather } from '../../domain/entities/Weather';
import { ProviderError, WeatherProvider } from '../../domain/ports/WeatherProvider';
import { http } from '../http/axiosClient';
import { InMemoryCache, CacheKeys } from '../cache/InMemoryCache';
import { Config } from '../config/config';
import { debugLog } from '../utils/debug';

// 🌤️ TIPOS DE AEMET
interface AemetObs {
  idema?: string;    // ID estación
  lat?: number;      // Latitud  
  lon?: number;      // Longitud
  fint?: string;     // "2025-08-13T12:00:00+0000"
  ta?: number;       // 🌡️ Temperatura ambiente (°C)
  hr?: number;       // 💧 Humedad relativa (%)
  pres?: number;     // 📊 Presión (hPa)
  pres_nmar?: number; // 📊 Presión nivel del mar (hPa)
  vv?: number;       // 👁️ Visibilidad (km) - NO es velocidad viento
  dv?: number;       // 🧭 Dirección viento (grados)
  vmax?: number;     // 💨 Velocidad máxima viento (m/s)
  prec?: number;     // 🌧️ Precipitación última hora (mm)
  ubi?: string;      // 📍 Ubicación
}

// 🧮 HAVERSINE FORMULA (distancia entre coordenadas)
function haversineSq(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ⏰ PARSER DE TIEMPO AEMET
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

        // El payload trae varias filas por estación (últimas horas, distinto
        // fint). Ordenar las de la estación elegida de más reciente a más
        // antigua y tomar, por campo, el primer valor numérico disponible
        // (la fila más reciente puede venir incompleta).
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
          // prec: solo la fila más reciente (un acumulado antiguo daría falsos "lloviendo").
          precipitationMm: typeof latest.prec === 'number' ? latest.prec : null,
          windSpeedMs: firstNumber((o) => o.vmax), // ✅ CORREGIDO: vmax es velocidad viento
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
   * Descarga (o recupera de caché) el payload completo de observaciones de
   * toda España bajo una clave única: una sola descarga por TTL sirve a las
   * ~20 playas (antes cada playa re-descargaba todo el payload).
   */
  private async getObservacionesCached(): Promise<AemetObs[]> {
    const cfg = Config.get();
    return this.cache.getOrSet('aemet:obs:todas', cfg.cacheTtlSeconds, async () => {
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
      return arr;
    });
  }

  /**
   * 📝 Generar descripción basada en datos de AEMET
   */
  private generateAemetDescription(obs: AemetObs): string | null {
    const temp = obs.ta;
    const humidity = obs.hr;
    const pressure = obs.pres || obs.pres_nmar;
    
    if (typeof temp !== 'number') return null;
    
    let desc = '';
    
    // Temperatura
    if (temp < 10) desc += 'Frío';
    else if (temp < 20) desc += 'Templado';
    else if (temp < 30) desc += 'Cálido';
    else desc += 'Muy cálido';
    
    // Humedad
    if (typeof humidity === 'number') {
      if (humidity > 80) desc += ' y húmedo';
      else if (humidity < 40) desc += ' y seco';
    }
    
    // Presión (tendencia del tiempo)
    if (typeof pressure === 'number') {
      if (pressure > 1020) desc += ', tiempo estable';
      else if (pressure < 1000) desc += ', tiempo inestable';
    }
    
    return desc || null;
  }

  /**
   * 🎨 Generar icono basado en datos de AEMET
   */
  private generateAemetIcon(obs: AemetObs): string | null {
    const temp = obs.ta;
    const humidity = obs.hr;
    
    if (typeof temp !== 'number') return null;
    
    // Lógica simple basada en temperatura y humedad
    if (typeof humidity === 'number' && humidity > 80) {
      return '04d'; // Nublado/húmedo
    } else if (typeof humidity === 'number' && humidity < 40) {
      return '01d'; // Despejado/seco
    } else {
      return '02d'; // Parcialmente nublado
    }
  }
}

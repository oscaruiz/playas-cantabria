import { http } from '../http/axiosClient';
import iconv from 'iconv-lite';
import { Config } from '../config/config';
import { InMemoryCache } from '../cache/InMemoryCache';
import { debugLog } from '../utils/debug';

export type AemetBeachDaily = {
  summary: string;
  temperature: number | null;
  waterTemperature: number | null;
  sensation: string | null;
  wind: string;
  waves: string;
  uvIndex: number | null;
  icon: number | null;
};

export type AemetBeachForecast = {
  source: 'AEMET';
  lastUpdatedIso: string;
  today: AemetBeachDaily;
  tomorrow: AemetBeachDaily;
};

export class AemetBeachForecastProvider {
  constructor(private readonly cache: InMemoryCache) {}

  async getByBeachCode(codigo: string): Promise<AemetBeachForecast> {
    const cfg = Config.get();
    if (!cfg.aemetApiKey) throw new Error('Missing AEMET_API_KEY');

    const cacheKey = `aemet:beach:${codigo}`;
    return this.cache.getOrSet(cacheKey, cfg.cacheTtlSeconds, async () => {
      const metaUrl = `https://opendata.aemet.es/opendata/api/prediccion/especifica/playa/${codigo}`;
      const meta = await http.get(metaUrl, {
        headers: { api_key: cfg.aemetApiKey as string },
        timeout: 5000,
      });

      const datosUrl: string | undefined = meta.data?.datos;
      if (!datosUrl) throw new Error('AEMET playa: missing datos URL');
      debugLog('aemet.playa.meta', meta.data);

      const datosResp = await http.get<ArrayBuffer>(datosUrl, {
        responseType: 'arraybuffer',
        timeout: 7000,
      });

      // decode latin1 → utf8 si hace falta
      let decoded = iconv.decode(Buffer.from(datosResp.data), 'latin1');
      if (decoded.includes('<html') || decoded.startsWith('<!DOCTYPE')) {
        throw new Error('AEMET playa: HTML received instead of JSON');
      }

      let parsed: any;
      try {
        parsed = JSON.parse(decoded);
      } catch {
        // si en realidad ya venía en utf-8
        decoded = Buffer.from(datosResp.data).toString('utf-8');
        parsed = JSON.parse(decoded);
      }

      if (!Array.isArray(parsed) || !parsed[0]?.prediccion?.dia) {
        throw new Error('AEMET playa: invalid payload');
      }

      debugLog('aemet.playa.sample', parsed[0]);
      const dias = parsed[0].prediccion.dia as any[];

      const mapDia = (dia: any): AemetBeachDaily => {
        const esc = dia?.estadoCielo ?? {};
        const viento = dia?.viento ?? {};
        const oleaje = dia?.oleaje ?? {};

        const desc =
          esc?.descripcion2 ?? esc?.descripcion1 ?? esc?.descripcion ?? 'Sin datos';
        const icon =
          (Number(esc?.f2) || null) ?? (Number(esc?.f1) || null);

        const tMax =
          (dia?.tmaxima?.valor1 ?? dia?.tMaxima?.valor1 ?? dia?.tmaxima ?? dia?.tMaxima) ?? null;

        const agua =
          (dia?.tagua?.valor1 ?? dia?.tAgua?.valor1 ?? dia?.tAgua ?? dia?.tagua) ?? null;

        const sens =
          dia?.stermica?.descripcion2 ?? dia?.stermica?.descripcion1 ??
          dia?.sTermica?.descripcion2 ?? dia?.sTermica?.descripcion1 ?? null;

        const vientoDesc =
          viento?.descripcion2 ?? viento?.descripcion1 ?? 'Sin datos';

        const oleajeDesc =
          oleaje?.descripcion2 ?? oleaje?.descripcion1 ?? 'Sin datos';

        const uv = (dia?.uvMax?.valor1 ?? dia?.uvMax) ?? null;

        return {
          summary: desc,
          temperature: tMax !== null ? Number(tMax) : null,
          waterTemperature: agua !== null ? Number(agua) : null,
          sensation: sens,
          wind: vientoDesc,
          waves: oleajeDesc,
          uvIndex: uv !== null ? Number(uv) : null,
          icon,
        };
      };

      const today = mapDia(dias[0] ?? {});
      const tomorrow = mapDia(dias[1] ?? dias[0] ?? {});

      return {
        source: 'AEMET',
        lastUpdatedIso: new Date().toISOString(),
        today,
        tomorrow,
      };
    });
  }
}

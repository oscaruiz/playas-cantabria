import { z } from 'zod';

function isFirebaseEnv(): boolean {
  return Boolean(
    process.env.FUNCTIONS_EMULATOR ||
      process.env.K_SERVICE ||
      process.env.FIREBASE_CONFIG
  );
}

function readFirebaseRuntimeConfig():
  | {
      port?: string | number;
      cors_origin?: string;
      aemet_api_key?: string;
      openweather_api_key?: string;
      cache_ttl_seconds?: string | number;
      featured_fresh_ttl_seconds?: string | number;
      featured_stale_ttl_seconds?: string | number;
      details_fresh_ttl_seconds?: string | number;
      details_stale_ttl_seconds?: string | number;
    }
  | undefined {
  try {
    const functions = require('firebase-functions') as any;

    const cfg = functions.config?.() ?? {};
    const flat = cfg as any;
    const ns = (cfg as any).playas ?? {};

    const port = flat.port ?? ns.port;
    const cors_origin = flat.cors_origin ?? ns.cors_origin;
    const aemet_api_key = flat.aemet_api_key ?? ns.aemet_api_key;
    const openweather_api_key = flat.openweather_api_key ?? ns.openweather_api_key;
    const cache_ttl_seconds = flat.cache_ttl_seconds ?? ns.cache_ttl_seconds;
    const featured_fresh_ttl_seconds =
      flat.featured_fresh_ttl_seconds ?? ns.featured_fresh_ttl_seconds;
    const featured_stale_ttl_seconds =
      flat.featured_stale_ttl_seconds ?? ns.featured_stale_ttl_seconds;
    const details_fresh_ttl_seconds =
      flat.details_fresh_ttl_seconds ?? ns.details_fresh_ttl_seconds;
    const details_stale_ttl_seconds =
      flat.details_stale_ttl_seconds ?? ns.details_stale_ttl_seconds;

    if (
      port === undefined &&
      cors_origin === undefined &&
      aemet_api_key === undefined &&
      openweather_api_key === undefined &&
      cache_ttl_seconds === undefined &&
      featured_fresh_ttl_seconds === undefined &&
      featured_stale_ttl_seconds === undefined &&
      details_fresh_ttl_seconds === undefined &&
      details_stale_ttl_seconds === undefined
    ) {
      return undefined;
    }

    return {
      port,
      cors_origin,
      aemet_api_key,
      openweather_api_key,
      cache_ttl_seconds,
      featured_fresh_ttl_seconds,
      featured_stale_ttl_seconds,
      details_fresh_ttl_seconds,
      details_stale_ttl_seconds,
    };
  } catch {
    return undefined;
  }
}

function readEnvConfig() {
  return {
    port: process.env.PORT,
    cors_origin: process.env.CORS_ORIGIN,
    aemet_api_key: process.env.AEMET_API_KEY,
    openweather_api_key: process.env.OPENWEATHER_API_KEY,
    cache_ttl_seconds: process.env.CACHE_TTL_SECONDS,
    featured_fresh_ttl_seconds: process.env.FEATURED_FRESH_TTL_SECONDS,
    featured_stale_ttl_seconds: process.env.FEATURED_STALE_TTL_SECONDS,
    details_fresh_ttl_seconds: process.env.DETAILS_FRESH_TTL_SECONDS,
    details_stale_ttl_seconds: process.env.DETAILS_STALE_TTL_SECONDS,
  };
}

const ConfigSchema = z.object({
  port: z.coerce.number().int().positive().default(4000),
  corsOrigin: z.string().default('*'),
  aemetApiKey: z.string().min(1).optional(),
  openWeatherApiKey: z.string().min(1).optional(),
  cacheTtlSeconds: z.coerce.number().int().positive().default(1800),
  featuredFreshTtlSeconds: z.coerce.number().int().positive().default(300),
  featuredStaleTtlSeconds: z.coerce.number().int().positive().default(3600),
  detailsFreshTtlSeconds: z.coerce.number().int().positive().default(60),
  detailsStaleTtlSeconds: z.coerce.number().int().positive().default(600),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

let cachedConfig: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  if (!isFirebaseEnv()) {
    require('dotenv').config();
  }

  const fromFirebase = isFirebaseEnv() ? readFirebaseRuntimeConfig() : undefined;
  const fromEnv = readEnvConfig();

  const merged = {
    port: fromFirebase?.port ?? fromEnv.port,
    corsOrigin: (fromFirebase?.cors_origin ?? fromEnv.cors_origin) as
      | string
      | undefined,
    aemetApiKey: (fromFirebase?.aemet_api_key ?? fromEnv.aemet_api_key) as
      | string
      | undefined,
    openWeatherApiKey: (fromFirebase?.openweather_api_key ??
      fromEnv.openweather_api_key) as string | undefined,
    cacheTtlSeconds:
      fromFirebase?.cache_ttl_seconds ?? fromEnv.cache_ttl_seconds,
    featuredFreshTtlSeconds:
      fromFirebase?.featured_fresh_ttl_seconds ?? fromEnv.featured_fresh_ttl_seconds,
    featuredStaleTtlSeconds:
      fromFirebase?.featured_stale_ttl_seconds ?? fromEnv.featured_stale_ttl_seconds,
    detailsFreshTtlSeconds:
      fromFirebase?.details_fresh_ttl_seconds ?? fromEnv.details_fresh_ttl_seconds,
    detailsStaleTtlSeconds:
      fromFirebase?.details_stale_ttl_seconds ?? fromEnv.details_stale_ttl_seconds,
  };

  const parsed = ConfigSchema.parse(merged);
  cachedConfig = parsed;
  return parsed;
}

/**
 * Hora y mes en Europe/Madrid (Render corre en UTC, así que no vale getHours()).
 */
function madridNow(now: Date): { hour: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: 'numeric',
    month: 'numeric',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { hour: get('hour'), month: get('month') };
}

/**
 * Multiplicador de TTL para las llamadas a proveedores externos.
 *
 * El consumo de cuota gratuita lo marca el reloj, no los usuarios: con la caché
 * por coordenadas, 500 visitas a la misma playa cuestan lo mismo que una. Así que
 * la palanca real es refrescar menos cuando el dato no le importa a nadie.
 *
 *  ×1  franja de playa (11:00–21:00) en temporada (jun–sep)
 *  ×4  resto del día en temporada
 *  ×12 fuera de temporada (oct–may): la app apenas se usa
 */
export function ttlFactor(now: Date = new Date()): number {
  const { hour, month } = madridNow(now);
  const enTemporada = month >= 6 && month <= 9;
  if (!enTemporada) return 12;
  return hour >= 11 && hour < 21 ? 1 : 4;
}

export const Config = {
  get(): AppConfig {
    return loadConfig();
  },
  /**
   * TTL para datos de AHORA: observación actual y precipitación en curso. Es
   * `CACHE_TTL_SECONDS` escalado por `ttlFactor()`.
   *
   * Es el que manda la frescura de "¿está lloviendo?", así que se mantiene corto
   * a propósito aunque cueste cuota: un nowcast de hace media hora no sirve.
   */
  providerTtlSeconds(): number {
    return loadConfig().cacheTtlSeconds * ttlFactor();
  },
  /** Ventana en la que un valor caducado se sigue sirviendo mientras se refresca. */
  providerStaleTtlSeconds(): number {
    return Config.providerTtlSeconds() * 6;
  },
  /**
   * TTL para PREVISIONES (forecast de OpenWeather, playas de AEMET, scraper web).
   *
   * AEMET publica la previsión de playa un par de veces al día, así que pedirla
   * cada 5 minutos como si fuera una observación gastaba miles de llamadas
   * diarias para recibir exactamente los mismos bytes. Se acota entre 30 min y
   * 6 h: ni tan corto que malgaste cuota, ni tan largo que un aviso de AEMET
   * tarde en aparecer.
   */
  forecastTtlSeconds(): number {
    const escalado = Config.providerTtlSeconds() * 6;
    return Math.min(Math.max(escalado, 1800), 21600);
  },
  /** Ventana stale de las previsiones: sobrevive a una caída larga de AEMET. */
  forecastStaleTtlSeconds(): number {
    return Config.forecastTtlSeconds() * 4;
  },
  port(): number {
    return loadConfig().port;
  },
  corsOrigin(): string {
    return loadConfig().corsOrigin;
  },
  aemetApiKey(): string | undefined {
    return loadConfig().aemetApiKey;
  },
  openWeatherApiKey(): string | undefined {
    return loadConfig().openWeatherApiKey;
  },
  cacheTtlSeconds(): number {
    return loadConfig().cacheTtlSeconds;
  },
  featuredFreshTtlSeconds(): number {
    return loadConfig().featuredFreshTtlSeconds;
  },
  featuredStaleTtlSeconds(): number {
    return loadConfig().featuredStaleTtlSeconds;
  },
  detailsFreshTtlSeconds(): number {
    return loadConfig().detailsFreshTtlSeconds;
  },
  detailsStaleTtlSeconds(): number {
    return loadConfig().detailsStaleTtlSeconds;
  },
};

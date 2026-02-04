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

    if (
      port === undefined &&
      cors_origin === undefined &&
      aemet_api_key === undefined &&
      openweather_api_key === undefined &&
      cache_ttl_seconds === undefined
    ) {
      return undefined;
    }

    return {
      port,
      cors_origin,
      aemet_api_key,
      openweather_api_key,
      cache_ttl_seconds,
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
  };
}

const ConfigSchema = z.object({
  port: z.coerce.number().int().positive().default(4000),
  corsOrigin: z.string().default('*'),
  aemetApiKey: z.string().min(1).optional(),
  openWeatherApiKey: z.string().min(1).optional(),
  cacheTtlSeconds: z.coerce.number().int().positive().default(300),
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
  };

  const parsed = ConfigSchema.parse(merged);
  cachedConfig = parsed;
  return parsed;
}

export const Config = {
  get(): AppConfig {
    return loadConfig();
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
};

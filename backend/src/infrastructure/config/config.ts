import { z } from 'zod';

/**
 * Detect if we're running inside Firebase Functions (prod or emulator).
 * We don't import firebase-functions at module top in non-Firebase envs to avoid side effects.
 */
function isFirebaseEnv(): boolean {
  // Common indicators in Functions (prod or emulator)
  return Boolean(
    process.env.FUNCTIONS_EMULATOR ||
      process.env.K_SERVICE || // Cloud Functions / Cloud Run
      process.env.FIREBASE_CONFIG
  );
}

/**
 * Try to read from firebase-functions -> functions.config()
 * Returns a plain object with our expected keys if present, otherwise undefined.
 */
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
    // Lazy load so local/docker doesn't require the module
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const functions = require('firebase-functions') as typeof import('firebase-functions');
    const cfg = functions.config?.() ?? {};
    // You can choose any namespace in Firebase env: `firebase functions:config:set playas.aemet_api_key="..."` etc.
    // We will look into two common shapes:
    // 1) flat (cfg.aemet_api_key) and
    // 2) namespaced (cfg.playas.aemet_api_key)
    const flat = cfg as any;
    const ns = (cfg as any).playas ?? {};

    const port = flat.port ?? ns.port;
    const cors_origin = flat.cors_origin ?? ns.cors_origin;
    const aemet_api_key = flat.aemet_api_key ?? ns.aemet_api_key;
    const openweather_api_key = flat.openweather_api_key ?? ns.openweather_api_key;
    const cache_ttl_seconds = flat.cache_ttl_seconds ?? ns.cache_ttl_seconds;

    // If nothing relevant is set, return undefined
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

/**
 * Read from process.env (dotenv should be loaded before calling loadConfig()).
 */
function readEnvConfig() {
  return {
    port: process.env.PORT,
    cors_origin: process.env.CORS_ORIGIN,
    aemet_api_key: process.env.AEMET_API_KEY,
    openweather_api_key: process.env.OPENWEATHER_API_KEY,
    cache_ttl_seconds: process.env.CACHE_TTL_SECONDS,
  };
}

// Zod schema to validate & coerce final config
const ConfigSchema = z.object({
  port: z.coerce.number().int().positive().default(4000),
  corsOrigin: z.string().default('*'),
  aemetApiKey: z.string().min(1, 'AEMET API key is required').optional(),
  openWeatherApiKey: z.string().min(1, 'OpenWeather API key is required').optional(),
  cacheTtlSeconds: z.coerce.number().int().positive().default(300), // 5 minutes default
});

export type AppConfig = z.infer<typeof ConfigSchema>;

/**
 * Singleton cache so multiple imports don’t re-parse.
 */
let cachedConfig: AppConfig | null = null;

/**
 * Load the unified config.
 * Priority:
 *   1) Firebase functions.config() (if present)
 *   2) .env / process.env (dotenv)
 *
 * Note:
 * - We allow missing provider keys here and let the weather use-case
 *   surface a clear error if both are missing at runtime.
 */
export function loadConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;

  // Load dotenv only when NOT in Firebase
  if (!isFirebaseEnv()) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('dotenv').config();
  }

  const fromFirebase = isFirebaseEnv() ? readFirebaseRuntimeConfig() : undefined;
  const fromEnv = readEnvConfig();

  const merged = {
    // Firebase first
    port: fromFirebase?.port ?? fromEnv.port,
    corsOrigin: (fromFirebase?.cors_origin ?? fromEnv.cors_origin) as string | undefined,
    aemetApiKey: (fromFirebase?.aemet_api_key ?? fromEnv.aemet_api_key) as string | undefined,
    openWeatherApiKey: (fromFirebase?.openweather_api_key ??
      fromEnv.openweather_api_key) as string | undefined,
    cacheTtlSeconds: fromFirebase?.cache_ttl_seconds ?? fromEnv.cache_ttl_seconds,
  };

  const parsed = ConfigSchema.parse(merged);
  cachedConfig = parsed;
  return parsed;
}

/**
 * Convenience helpers for consumers that only need one value.
 */
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

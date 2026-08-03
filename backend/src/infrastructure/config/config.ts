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
      sky_decision_ttl_seconds?: string | number;
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
    const sky_decision_ttl_seconds =
      flat.sky_decision_ttl_seconds ?? ns.sky_decision_ttl_seconds;

    if (
      port === undefined &&
      cors_origin === undefined &&
      aemet_api_key === undefined &&
      openweather_api_key === undefined &&
      cache_ttl_seconds === undefined &&
      featured_fresh_ttl_seconds === undefined &&
      featured_stale_ttl_seconds === undefined &&
      details_fresh_ttl_seconds === undefined &&
      details_stale_ttl_seconds === undefined &&
      sky_decision_ttl_seconds === undefined
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
      sky_decision_ttl_seconds,
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
    sky_decision_ttl_seconds: process.env.SKY_DECISION_TTL_SECONDS,
  };
}

const ConfigSchema = z.object({
  port: z.coerce.number().int().positive().default(4000),
  corsOrigin: z.string().default('*'),
  aemetApiKey: z.string().min(1).optional(),
  openWeatherApiKey: z.string().min(1).optional(),
  cacheTtlSeconds: z.coerce.number().int().positive().default(1800),
  // Same window as the detail ON PURPOSE. When it was five times longer, the
  // home page and the detail of the same beach sampled the sky at different
  // moments and said different things — the ranking is 46 beaches read from
  // the per-coordinate provider cache, so refreshing it as often as the
  // detail costs CPU, not quota (quota is set by `providerTtlSeconds`).
  featuredFreshTtlSeconds: z.coerce.number().int().positive().default(60),
  featuredStaleTtlSeconds: z.coerce.number().int().positive().default(3600),
  detailsFreshTtlSeconds: z.coerce.number().int().positive().default(60),
  detailsStaleTtlSeconds: z.coerce.number().int().positive().default(600),
  skyDecisionTtlSeconds: z.coerce.number().int().positive().default(300),
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
    skyDecisionTtlSeconds:
      fromFirebase?.sky_decision_ttl_seconds ?? fromEnv.sky_decision_ttl_seconds,
  };

  const parsed = ConfigSchema.parse(merged);
  cachedConfig = parsed;
  return parsed;
}

/**
 * Hour and month in Europe/Madrid (Render runs in UTC, so getHours() won't do).
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

function franjaYTemporada(now: Date): { enTemporada: boolean; enFranja: boolean } {
  const { hour, month } = madridNow(now);
  return {
    enTemporada: month >= 6 && month <= 9,
    enFranja: hour >= 11 && hour < 21,
  };
}

/**
 * Are we in the bathing season (June–September, Madrid time)?
 *
 * Shares its definition with `ttlFactor` and `enFranjaDePlaya`: out of season
 * there are no hoisted flags, so anything that watches over flag freshness has
 * to keep quiet or it teaches people to ignore it.
 */
export function enTemporadaDePlaya(now: Date = new Date()): boolean {
  return franjaYTemporada(now).enTemporada;
}

/**
 * Are we in the in-season beach window (11:00–21:00 Madrid time)?
 *
 * Shares its definition with `ttlFactor` on purpose: it is the same idea of
 * "right now there are people looking at the beach". Used by the sky corrector,
 * which must only act during the day and afternoon.
 */
export function enFranjaDePlaya(now: Date = new Date()): boolean {
  const { enTemporada, enFranja } = franjaYTemporada(now);
  return enTemporada && enFranja;
}

export type ModoCorreccionCielo = 'off' | 'shadow' | 'on';

/**
 * Mode of the sky corrector based on observed insolation.
 *
 *  on      applies the correction (DEFAULT)
 *  shadow  computes and counts what it would do, but returns the data untouched
 *  off     doesn't even compute it
 *
 * It was born in `shadow` to validate it without touching production. Switched to `on` on
 * 29-jul with the coast overcast: the Santander METAR gave OVC020 (fully
 * overcast) and insolation was 0 minutes along the whole coast, while the models
 * kept saying clear at the 46 beaches. The shadow validation gave 44
 * corrections and 2 discards, exactly as expected.
 *
 * The default lives here and not in a Render dashboard variable on purpose:
 * that way it is versioned, and the snapshot generator in CI uses the same criterion
 * as the server (if they diverge, the first response after startup comes out with the
 * sky uncorrected until the first refresh).
 *
 * It is read from `process.env` on every call instead of going through `loadConfig()`: it
 * is not a secret and does not travel in the Firebase runtime config, and this way it can
 * be changed in a test without invalidating the process's cached config.
 */
export function skyCorrectionMode(): ModoCorreccionCielo {
  const v = (process.env.SKY_CORRECTION ?? '').trim().toLowerCase();
  return v === 'shadow' || v === 'off' ? v : 'on';
}

/**
 * TTL multiplier for calls to external providers.
 *
 * Free-quota consumption is driven by the clock, not the users: with the
 * per-coordinates cache, 500 visits to the same beach cost the same as one. So
 * the real lever is refreshing less when nobody cares about the data.
 *
 *  ×1  beach window (11:00–21:00) in season (jun–sep)
 *  ×4  rest of the day in season
 *  ×12 out of season (oct–may): the app is barely used
 */
export function ttlFactor(now: Date = new Date()): number {
  const { enTemporada, enFranja } = franjaYTemporada(now);
  if (!enTemporada) return 12;
  return enFranja ? 1 : 4;
}

export const Config = {
  get(): AppConfig {
    return loadConfig();
  },
  /**
   * TTL for NOW data: current observation and ongoing precipitation. It is
   * `CACHE_TTL_SECONDS` scaled by `ttlFactor()`.
   *
   * It is what drives the freshness of "is it raining?", so it is kept short
   * on purpose even if it costs quota: a nowcast from half an hour ago is useless.
   */
  providerTtlSeconds(): number {
    return loadConfig().cacheTtlSeconds * ttlFactor();
  },
  /** Window during which an expired value keeps being served while it refreshes. */
  providerStaleTtlSeconds(): number {
    return Config.providerTtlSeconds() * 6;
  },
  /**
   * TTL for FORECASTS (OpenWeather forecast, AEMET beaches, web scraper).
   *
   * AEMET publishes the beach forecast a couple of times a day, so requesting it
   * every 5 minutes as if it were an observation spent thousands of calls
   * a day to receive exactly the same bytes. It is bounded between 30 min and
   * 6 h: neither so short that it wastes quota, nor so long that an AEMET warning
   * takes long to show up.
   */
  forecastTtlSeconds(): number {
    const escalado = Config.providerTtlSeconds() * 6;
    return Math.min(Math.max(escalado, 1800), 21600);
  },
  /** Stale window for forecasts: survives a long AEMET outage. */
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
  /**
   * How long a sky-correction decision is reused by every caller.
   *
   * The rule: it must OUTLIVE the longest response window of the two screens.
   * Only then are two responses assembled at different moments guaranteed to
   * fall inside the same decision — which is what stops the listing and the
   * detail from showing two skies for one beach. It is therefore deliberately
   * longer than `featuredFreshTtlSeconds`, not equal to it.
   */
  skyDecisionTtlSeconds(): number {
    return loadConfig().skyDecisionTtlSeconds;
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

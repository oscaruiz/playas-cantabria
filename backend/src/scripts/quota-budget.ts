/**
 * Estimates the outbound requests per day that the loaded regions cost, and
 * compares them against the free tiers.
 *
 * It exists because the quotas are SHARED: every region hits the same
 * OpenWeather and Open-Meteo keys, so a contribution that adds 200 beaches
 * does not degrade its own region — it degrades everyone's. Reviewing a pull
 * request by eye does not catch that; a number does.
 *
 *   npm run quota:budget            → table + exit 1 if any limit is exceeded
 *   npm run quota:budget -- --json  → machine-readable, for the PR comment
 *
 * The model is deliberately WORST CASE: it assumes enough traffic for every
 * cache entry to be recomputed the moment it expires. Real consumption is
 * lower and `/api/_diag/metrics` reports it — this is a ceiling, not a
 * forecast.
 */
import fs from 'fs';
import { ttlFactor, loadConfig } from '../infrastructure/config/config';
import { regionRegistry } from '../regions';
import type { RegionConfig } from '../regions';

/** Production default for CACHE_TTL_SECONDS; every figure below scales with it. */
const DEFAULT_CACHE_TTL_SECONDS = 1800;

/** Free tiers, as published by each provider. */
export const LIMITS = {
  openWeatherPerDay: 1_000_000 / 30,
  openWeatherPerMinute: 60,
  openMeteoPerDay: 10_000,
  /**
   * Open-Meteo publishes a MONTHLY ceiling too, and it is the binding one:
   * 300.000/month is 9.677 a day in a 31-day month, below its own 10.000/day.
   * Checking only the daily figure approved 9.720/day — inside the daily limit
   * and 301.320 over a July, i.e. a budget that ran out before the month did.
   */
  openMeteoPerMonth: 300_000,
} as const;

/** Longest month: the worst case the monthly ceiling has to survive. */
const DIAS_MES_PEOR = 31;

interface RegionUsage {
  id: string;
  beaches: number;
  beachesWithAemet: number;
  openWeatherPerDay: number;
  openMeteoPerDay: number;
  aemetPerDay: number;
}

/**
 * Requests an hour costs, given the TTLs in force at that hour. The provider
 * caches are keyed by coordinate, so the driver is how often they expire —
 * not how often `/featured` is asked for.
 */
function hourlyCost(beaches: number, beachesWithAemet: number, factor: number) {
  const cfg = loadConfig();
  const providerTtl = cfg.cacheTtlSeconds * factor;
  const forecastTtl = Math.min(Math.max(providerTtl * 6, 1800), 21600);
  const perHour = (ttl: number) => 3600 / ttl;

  return {
    // Current observation and the 3h forecast, both per beach coordinate.
    openWeather: beaches * perHour(providerTtl) + beaches * perHour(forecastTtl),
    // Rain nowcast, per beach coordinate.
    openMeteo: beaches * perHour(providerTtl),
    // Beach sheet per AEMET code, plus ONE Spain-wide observation download
    // that every region shares (see AemetWeatherProvider).
    aemet: beachesWithAemet * perHour(forecastTtl),
  };
}

function countBeaches(region: RegionConfig): { total: number; withAemet: number } {
  const catalog = JSON.parse(fs.readFileSync(region.catalogPath, 'utf8')) as Array<{
    sinAemet?: boolean;
  }>;
  return {
    total: catalog.length,
    withAemet: catalog.filter((beach) => beach.sinAemet !== true).length,
  };
}

/** A representative in-season day, hour by hour, using the real `ttlFactor`. */
function usageFor(region: RegionConfig): RegionUsage {
  const { total, withAemet } = countBeaches(region);
  const usage: RegionUsage = {
    id: region.id,
    beaches: total,
    beachesWithAemet: withAemet,
    openWeatherPerDay: 0,
    openMeteoPerDay: 0,
    aemetPerDay: 0,
  };

  for (let hour = 0; hour < 24; hour += 1) {
    // July, so `ttlFactor` reports in-season; the hour decides the window.
    const momento = new Date(Date.UTC(2026, 6, 15, hour, 0, 0));
    const cost = hourlyCost(total, withAemet, ttlFactor(momento));
    usage.openWeatherPerDay += cost.openWeather;
    usage.openMeteoPerDay += cost.openMeteo;
    usage.aemetPerDay += cost.aemet;
  }

  return usage;
}

/** Worst minute: everything expiring at once inside the beach window. */
export function peakOpenWeatherPerMinute(regions: Pick<RegionUsage, 'beaches'>[]): number {
  const beaches = regions.reduce((sum, region) => sum + region.beaches, 0);
  // TTLs determine daily consumption, but they do not spread expirations evenly.
  // After a cold start (or when a batch of coordinate keys expires together),
  // every beach in the featured fan-out can refresh its current observation
  // inside the same minute. Forecast calls are detail-driven rather than part
  // of that all-beach fan-out. The host limiter bounds concurrency, not requests per minute,
  // so using the average `beaches / TTL` would approve unsafe cold-start bursts.
  return beaches;
}

function main(): void {
  const regions = regionRegistry.all();
  if (regions.length === 0) throw new Error('No valid region to budget');

  const usages = regions.map(usageFor);
  const totals = {
    beaches: usages.reduce((s, u) => s + u.beaches, 0),
    openWeatherPerDay: usages.reduce((s, u) => s + u.openWeatherPerDay, 0),
    openMeteoPerDay: usages.reduce((s, u) => s + u.openMeteoPerDay, 0),
    // The Spain-wide AEMET download is shared, so it is counted once for all.
    aemetPerDay: usages.reduce((s, u) => s + u.aemetPerDay, 0) + 24 * 2,
  };
  const peakPerMinute = peakOpenWeatherPerMinute(usages);

  const breaches: string[] = [];
  if (totals.openWeatherPerDay > LIMITS.openWeatherPerDay) {
    breaches.push(
      `OpenWeather: ${Math.round(totals.openWeatherPerDay)}/day over the ${Math.round(LIMITS.openWeatherPerDay)}/day free tier`,
    );
  }
  if (peakPerMinute > LIMITS.openWeatherPerMinute) {
    breaches.push(
      `OpenWeather: peak ${Math.round(peakPerMinute)}/min over the ${LIMITS.openWeatherPerMinute}/min limit`,
    );
  }
  if (totals.openMeteoPerDay > LIMITS.openMeteoPerDay) {
    breaches.push(
      `Open-Meteo: ${Math.round(totals.openMeteoPerDay)}/day over the ${LIMITS.openMeteoPerDay}/day free tier`,
    );
  }
  const openMeteoPerMonth = totals.openMeteoPerDay * DIAS_MES_PEOR;
  if (openMeteoPerMonth > LIMITS.openMeteoPerMonth) {
    breaches.push(
      `Open-Meteo: ${Math.round(openMeteoPerMonth)}/month over the ${LIMITS.openMeteoPerMonth}/month free tier ` +
        `(${DIAS_MES_PEOR} days at ${Math.round(totals.openMeteoPerDay)}/day; the monthly ceiling is ` +
        `${Math.floor(LIMITS.openMeteoPerMonth / DIAS_MES_PEOR)}/day)`,
    );
  }

  if (process.argv.includes('--json')) {
    process.stdout.write(
      `${JSON.stringify({ regions: usages, totals: { ...totals, openMeteoPerMonth }, peakPerMinute, breaches }, null, 2)}\n`,
    );
  } else {
    process.stdout.write(render(usages, totals, peakPerMinute, breaches));
  }

  if (breaches.length > 0) process.exitCode = 1;
}

export function render(
  usages: RegionUsage[],
  totals: { beaches: number; openWeatherPerDay: number; openMeteoPerDay: number; aemetPerDay: number },
  peakPerMinute: number,
  breaches: string[],
): string {
  const round = (value: number) => Math.round(value).toLocaleString('en-US');
  const rows = usages
    .map((u) => `| ${u.id} | ${u.beaches} | ${round(u.openWeatherPerDay)} | ${round(u.openMeteoPerDay)} | ${round(u.aemetPerDay)} |`)
    .join('\n');

  const pct = (value: number, limit: number) => `${Math.round((value / limit) * 100)}%`;

  // Stated, never implicit: the whole estimate scales with this TTL, and a
  // local .env that lowers it multiplies every figure. Reading the table
  // without knowing which value produced it is how you conclude the wrong thing.
  const ttl = loadConfig().cacheTtlSeconds;
  const ttlNota =
    ttl === DEFAULT_CACHE_TTL_SECONDS
      ? `CACHE_TTL_SECONDS = ${ttl}s (the default)`
      : `**CACHE_TTL_SECONDS = ${ttl}s**, not the ${DEFAULT_CACHE_TTL_SECONDS}s default: ` +
        `these figures are ${(DEFAULT_CACHE_TTL_SECONDS / ttl).toFixed(1)}x the production ones`;

  return [
    '### Quota budget (worst case, in season)',
    '',
    `Computed with ${ttlNota}.`,
    '',
    '| Region | Beaches | OpenWeather/day | Open-Meteo/day | AEMET/day |',
    '|---|---:|---:|---:|---:|',
    rows,
    `| **total** | **${totals.beaches}** | **${round(totals.openWeatherPerDay)}** | **${round(totals.openMeteoPerDay)}** | **${round(totals.aemetPerDay)}** |`,
    '',
    `- OpenWeather: ${pct(totals.openWeatherPerDay, LIMITS.openWeatherPerDay)} of the free tier (1M/month), peak ${Math.round(peakPerMinute)}/min of 60.`,
    `- Open-Meteo: ${pct(totals.openMeteoPerDay, LIMITS.openMeteoPerDay)} of the free tier (10k/day), ` +
      `${pct(totals.openMeteoPerDay * DIAS_MES_PEOR, LIMITS.openMeteoPerMonth)} of the monthly one ` +
      `(300k/month over ${DIAS_MES_PEOR} days) — the monthly ceiling binds first.`,
    '',
    breaches.length > 0
      ? `**Over budget.** These regions do not fit together on the free tiers:\n${breaches.map((b) => `- ${b}`).join('\n')}`
      : 'Within budget.',
    '',
    '_Ceiling, not a forecast: it assumes every cache entry is recomputed the',
    'moment it expires. `/api/_diag/metrics` reports the real consumption._',
    '',
  ].join('\n');
}

if (require.main === module) main();

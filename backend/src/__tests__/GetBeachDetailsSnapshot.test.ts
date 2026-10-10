import { describe, it, expect, vi } from 'vitest';
import { InMemoryCache } from '../infrastructure/cache/InMemoryCache';
import { FeaturedBeachMapper } from '../application/mappers/FeaturedBeachMapper';
import { GetBeachDetails } from '../domain/use-cases/GetBeachDetails';
import { GetFeaturedBeaches } from '../domain/use-cases/GetFeaturedBeaches';
import type { BeachConditions } from '../domain/use-cases/BeachConditions';
import type { FeaturedBeachResult } from '../domain/use-cases/BeachAssessment';
import type { Beach } from '../domain/entities/Beach';
import type { Weather } from '../domain/entities/Weather';
import type { BeachRepository } from '../domain/ports/BeachRepository';

/**
 * The card on the front page and the detail one tap away are the same
 * picture: the detail is built from the ranking's own entry for the beach
 * instead of asking the providers again at another instant (10-oct-2026).
 */

const BEACH: Beach = {
  id: '3902401', name: 'Cóbreces', municipality: 'Alfoz', aemetCode: '3902401',
  latitude: 43.39, longitude: -4.21,
};
const KEY = 'featured:test:beaches';
const GENERATED = 1_760_000_000_000;

const sky = (description: string): Weather => ({
  source: 'OpenWeather', timestamp: 1, temperatureC: 22, description, icon: '02d',
  windSpeedMs: 2, windDirectionDeg: 0, humidityPct: 50, pressureHPa: 1013,
});

const entry = (over: Partial<FeaturedBeachResult> = {}): FeaturedBeachResult => ({
  beach: BEACH,
  weather: sky('algo de nubes'),
  flag: null,
  rawFlag: { color: 'green', timestamp: 2 },
  score: 70,
  reason: 'r',
  downgradeReason: null,
  enrichment: null,
  rain: { status: 'dry', precipitationMm: 0, lastHourOnly: false, sources: [], timestamp: 3, outlook: null },
  ventanaDia: null,
  ...over,
});

function build(ranking?: FeaturedBeachResult[]) {
  const cache = new InMemoryCache();
  if (ranking) {
    cache.seed(KEY, { mejores: [], revisar: [], resumenTodas: ranking, generadoEn: GENERATED }, 0, 3600);
  }
  const repo = { getById: async () => BEACH } as unknown as BeachRepository;
  const now = vi.fn(async () => ({ weather: sky('nubes'), flag: null, rain: null }));
  // The flag is read now: here a red hoisted after the ranking was assembled.
  const flagNow = vi.fn(async () => ({ color: 'red' as const, timestamp: 9 }));
  const conditions = { now, flagNow } as unknown as BeachConditions;
  const featured = new GetFeaturedBeaches(repo, {} as never, cache, conditions, [], {
    cacheKey: KEY, freshTtlSeconds: () => 300, staleTtlSeconds: () => 3600,
  });
  return { details: new GetBeachDetails(repo, conditions, featured), now, featured };
}

describe('GetBeachDetails from the ranking in force', () => {
  it("uses the ranking's entry as it is, even stale, and asks no weather provider", async () => {
    const { details, now } = build([entry()]);

    const d = await details.execute(BEACH.id);

    expect(now).not.toHaveBeenCalled();
    expect(d.weather?.description).toBe('algo de nubes');
    expect(d.rain?.timestamp).toBe(3);
    expect(d.ventanaDia).toBeNull();
    expect(d.rankingGeneradoEn).toBe(GENERATED);
  });

  it('computes the conditions itself when there is no ranking yet (cold start)', async () => {
    const { details, now } = build();

    const d = await details.execute(BEACH.id);

    expect(now).toHaveBeenCalledOnce();
    expect(d.weather?.description).toBe('nubes');
    expect(d.rankingGeneradoEn).toBeNull();
  });

  it('reads the flag now, not from the ranking: a red hoisted since must not wait (found by Codex)', async () => {
    // The ranking's entry says green; a red was hoisted after it was assembled.
    const { details } = build([entry()]);

    const d = await details.execute(BEACH.id);

    expect(d.flag?.color).toBe('red');
  });

  it('reading the snapshot never triggers the fan-out over every beach', () => {
    const { featured } = build();
    expect(featured.snapshotFor(BEACH.id)).toBeNull();
    expect(featured.generation()).toBeNull();
  });
});

describe('InMemoryCache.peek', () => {
  it('serves fresh and stale values and never computes', () => {
    let t = 0;
    const cache = new InMemoryCache(() => t);
    cache.seed('k', 'v', 1, 10);
    expect(cache.peek('k')).toBe('v');
    t = 5_000;
    expect(cache.get('k')).toBeUndefined(); // stale: `get` says no
    expect(cache.peek('k')).toBe('v');
    t = 11_000;
    expect(cache.peek('k')).toBeUndefined();
  });
});

describe('FeaturedBeachMapper judges the flag when serving, not when assembling', () => {
  it('a ranking assembled before surveillance began shows the flag once it has (found by Codex)', () => {
    // Assembled at 09:59 UTC (11:59 Madrid): out of hours, so `flag` is null;
    // served at 10:01 UTC with the green flying, as the detail shows it.
    const green = { color: 'green' as const, timestamp: Date.parse('2026-07-01T09:58:00Z'), schedule: '12:00-19:00' };
    const result = entry({ flag: null, rawFlag: green });

    const card = FeaturedBeachMapper.toDTO([], [], [result], 0, Date.parse('2026-07-01T10:01:00Z')).resumenTodas[0];

    expect(card.bandera).toBe('Verde');
  });
});

import { describe, expect, it } from 'vitest';
import { GetFeaturedBeaches, type FeaturedBeachesFullResult } from '../domain/use-cases/GetFeaturedBeaches';
import { CacheKeys, InMemoryCache } from '../infrastructure/cache/InMemoryCache';
import type { Beach } from '../domain/entities/Beach';

const BEACH: Beach = {
  id: '1',
  name: 'Playa Test',
  municipality: 'Test',
  aemetCode: '0000001',
  latitude: 43.4,
  longitude: -4,
};

function useCase(cache: InMemoryCache) {
  const repo = { getAll: async () => [BEACH], getById: async () => BEACH };
  const unavailableSunshine = {
    getSunshineNear: async () => { throw new Error('AEMET unavailable'); },
  };
  const unused = {};
  return new GetFeaturedBeaches(
    repo as never,
    unused as never,
    unused as never,
    unused as never,
    unused as never,
    cache,
    unused as never,
    unavailableSunshine,
    'cantabria',
    [],
  );
}

describe('GetFeaturedBeaches — caída de insolación AEMET', () => {
  it('falla el cálculo si no existe un ranking anterior que preservar', async () => {
    await expect(useCase(new InMemoryCache()).execute()).rejects.toThrow('AEMET unavailable');
  });

  it('conserva el ranking stale en vez de reemplazarlo por cielos sin corregir', async () => {
    const cache = new InMemoryCache();
    const anterior: FeaturedBeachesFullResult = { mejores: [], revisar: [], resumenTodas: [] };
    const key = CacheKeys.featuredBeaches('cantabria');
    cache.seed(key, anterior, 0, 3600);

    expect(await useCase(cache).execute()).toBe(anterior);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cache.state(key)).toBe('stale');
  });
});

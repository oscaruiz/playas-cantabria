import { describe, it, expect } from 'vitest';
import { createContainer } from '../infrastructure/di';
import { InMemoryCache } from '../infrastructure/cache/InMemoryCache';

// Smoke test for the real DI wiring: every service the routes depend on must
// resolve without throwing. Catches broken constructor signatures or missing
// registrations introduced by a refactor, without touching the network
// (constructors do no I/O; the cache override avoids the Upstash-backed one).
describe('DI container', () => {
  it('resolves the full production wiring', () => {
    const container = createContainer({ cache: new InMemoryCache() });
    const services = [
      'cache',
      'beachRepository',
      'aemetWeatherProvider',
      'openWeatherProvider',
      'redCrossFlagProvider',
      'flagProvider',
      'aemetBeachForecastProvider',
      'aemetBeachWebScraper',
      'openMeteoPrecipitationProvider',
      'getAllBeaches',
      'getBeachById',
      'getBeachDetails',
      'getRainNowcast',
      'getFeaturedBeaches',
      'legacyDetailsAssembler',
    ];
    for (const name of services) {
      expect(container.get(name), name).toBeTruthy();
    }
  });
});

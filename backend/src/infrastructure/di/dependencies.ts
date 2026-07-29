import { DIContainer } from './DIContainer';
import { InMemoryCache } from '../cache/InMemoryCache';
import { TieredCache } from '../cache/TieredCache';
import { UpstashRedisStore } from '../cache/UpstashRedisStore';
import { JsonBeachRepository } from '../repositories/JsonBeachRepository';
import { AemetWeatherProvider } from '../providers/AemetWeatherProvider';
import { OpenWeatherWeatherProvider } from '../providers/OpenWeatherWeatherProvider';
import { RedCrossFlagProvider } from '../providers/RedCrossFlagProvider';
import { GetAllBeaches } from '../../domain/use-cases/GetAllBeaches';
import { GetBeachById } from '../../domain/use-cases/GetBeachById';
import { GetBeachDetails } from '../../domain/use-cases/GetBeachDetails';
import { LegacyDetailsAssembler } from '../../application/services/LegacyDetailsAssembler';
import { GetFeaturedBeaches } from '../../domain/use-cases/GetFeaturedBeaches';
import { GetRainNowcast } from '../../domain/use-cases/GetRainNowcast';
import { AemetBeachForecastProvider } from '../providers/AemetBeachForecastProvider';
import { AemetBeachWebScraper } from '../providers/AemetBeachWebScraper';
import { OpenMeteoPrecipitationProvider } from '../providers/OpenMeteoPrecipitationProvider';

/**
 * Caché de la app: con Upstash configurado (UPSTASH_REDIS_REST_URL/TOKEN) se usa
 * la de dos niveles, que sobrevive al dormido y a los despliegues de Render free.
 * Sin esas variables, exactamente la de siempre en memoria.
 */
function crearCache(): InMemoryCache {
  const l2 = UpstashRedisStore.fromEnv();
  return l2 ? new TieredCache(l2) : new InMemoryCache();
}

export function configureDependencies(container: DIContainer, overrides: { cache?: InMemoryCache } = {}): void {
  // Infrastructure Layer - Singletons
  container.registerSingleton('cache', () => overrides.cache ?? crearCache());
  
  container.registerSingleton('beachRepository', (c) => 
    new JsonBeachRepository(c.get('cache'))
  );
  
  container.registerSingleton('aemetWeatherProvider', (c) => 
    new AemetWeatherProvider(c.get('cache'))
  );
  
  container.registerSingleton('openWeatherProvider', (c) => 
    new OpenWeatherWeatherProvider(c.get('cache'))
  );
  
  container.registerSingleton('redCrossFlagProvider', (c) => 
    new RedCrossFlagProvider(c.get('cache'))
  );

  container.registerSingleton('aemetBeachForecastProvider', (c) =>
    new AemetBeachForecastProvider(c.get('cache'))
  );

  container.registerSingleton('aemetBeachWebScraper', (c) =>
    new AemetBeachWebScraper(c.get('cache'))
  );

  container.registerSingleton('openMeteoPrecipitationProvider', (c) =>
    new OpenMeteoPrecipitationProvider(c.get('cache'))
  );

  // Domain Layer - Use Cases
  container.register('getAllBeaches', (c) => 
    new GetAllBeaches(c.get('beachRepository'))
  );
  
  container.register('getBeachById', (c) => 
    new GetBeachById(c.get('beachRepository'))
  );
  
  container.register('getBeachDetails', (c) => 
    new GetBeachDetails(
      c.get('beachRepository'),
      c.get('aemetWeatherProvider'),
      c.get('openWeatherProvider'),
      c.get('redCrossFlagProvider'),
      null // tides provider - not implemented yet
    )
  );

  container.register('getRainNowcast', (c) =>
    new GetRainNowcast(
      c.get('openWeatherProvider'),
      c.get('aemetWeatherProvider'),
      c.get('openMeteoPrecipitationProvider'),
      c.get('cache'),
    )
  );

  container.register('getFeaturedBeaches', (c) =>
    new GetFeaturedBeaches(
      c.get('beachRepository'),
      c.get('aemetWeatherProvider'),
      c.get('openWeatherProvider'),
      c.get('redCrossFlagProvider'),
      c.get('aemetBeachForecastProvider'),
      c.get('cache'),
      c.get('getRainNowcast'),
      // Mismo objeto que 'aemetWeatherProvider': implementa también SunshineProvider.
      c.get('aemetWeatherProvider'),
    )
  );

  // Application Layer - Services
  container.register('legacyDetailsAssembler', (c) =>
    new LegacyDetailsAssembler(
      c.get('getBeachDetails'),
      c.get('aemetBeachWebScraper'),
      c.get('aemetBeachForecastProvider'),
      c.get('openWeatherProvider'),
      c.get('getRainNowcast'),
      c.get('cache'),
      c.get('aemetWeatherProvider'),
    )
  );
}

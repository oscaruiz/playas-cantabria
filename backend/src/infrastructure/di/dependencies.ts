import { DIContainer } from './DIContainer';
import { InMemoryCache } from '../cache/InMemoryCache';
import { JsonBeachRepository } from '../repositories/JsonBeachRepository';
import { AemetWeatherProvider } from '../providers/AemetWeatherProvider';
import { OpenWeatherWeatherProvider } from '../providers/OpenWeatherWeatherProvider';
import { RedCrossFlagProvider } from '../providers/RedCrossFlagProvider';
import { GetAllBeaches } from '../../domain/use-cases/GetAllBeaches';
import { GetBeachById } from '../../domain/use-cases/GetBeachById';
import { GetBeachDetails } from '../../domain/use-cases/GetBeachDetails';
import { DetailsAssembler } from '../../application/services/DetailsAssembler';
import { LegacyDetailsAssembler } from '../../application/services/LegacyDetailsAssembler';

export function configureDependencies(container: DIContainer, overrides: { cache?: InMemoryCache } = {}): void {
  // Infrastructure Layer - Singletons
  container.registerSingleton('cache', () => overrides.cache ?? new InMemoryCache());
  
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

  // Application Layer - Services
  container.register('detailsAssembler', (c) => 
    new DetailsAssembler(c.get('getBeachDetails'))
  );
  
  container.register('legacyDetailsAssembler', (c) => 
    new LegacyDetailsAssembler(
      c.get('getBeachDetails'),
      c.get('openWeatherProvider')
    )
  );
}

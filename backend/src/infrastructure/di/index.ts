import { DIContainer } from './DIContainer';
import { configureDependencies } from './dependencies';
import { InMemoryCache } from '../cache/InMemoryCache';

/**
 * Factory function to create a pre-configured DI Container
 */
export function createContainer(overrides: { cache?: InMemoryCache } = {}): DIContainer {
  const container = new DIContainer();
  configureDependencies(container, overrides);
  return container;
}

/**
 * Get a specific service from a container with type safety
 */
export function getService<T>(container: DIContainer, serviceName: string): T {
  return container.get<T>(serviceName);
}

/**
 * Example usage and available services
 */
export const SERVICES = {
  // Infrastructure
  CACHE: 'cache',
  BEACH_REPOSITORY: 'beachRepository',
  AEMET_WEATHER_PROVIDER: 'aemetWeatherProvider',
  OPENWEATHER_PROVIDER: 'openWeatherProvider',
  REDCROSS_FLAG_PROVIDER: 'redCrossFlagProvider',
  
  // Use Cases
  GET_ALL_BEACHES: 'getAllBeaches',
  GET_BEACH_BY_ID: 'getBeachById',
  GET_BEACH_DETAILS: 'getBeachDetails',
  
  // Application Services
  DETAILS_ASSEMBLER: 'detailsAssembler',
  LEGACY_DETAILS_ASSEMBLER: 'legacyDetailsAssembler',
} as const;

/**
 * Type-safe service getters
 */
export class ServiceLocator {
  constructor(private container: DIContainer) {}

  get cache() {
    return this.container.get<InMemoryCache>(SERVICES.CACHE);
  }

  get beachRepository() {
    return this.container.get(SERVICES.BEACH_REPOSITORY);
  }

  get getAllBeaches() {
    return this.container.get(SERVICES.GET_ALL_BEACHES);
  }

  get getBeachById() {
    return this.container.get(SERVICES.GET_BEACH_BY_ID);
  }

  get detailsAssembler() {
    return this.container.get(SERVICES.DETAILS_ASSEMBLER);
  }
}

/* 
EXAMPLE USAGE:

// Basic usage
const container = createContainer();
const beachRepo = container.get('beachRepository');

// With overrides
const customCache = new InMemoryCache();
const container = createContainer({ cache: customCache });

// Type-safe usage
const getAllBeaches = getService<GetAllBeaches>(container, SERVICES.GET_ALL_BEACHES);

// Service locator pattern
const services = new ServiceLocator(container);
const beaches = await services.getAllBeaches.execute();
*/

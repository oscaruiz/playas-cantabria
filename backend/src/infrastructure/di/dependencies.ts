import { DIContainer } from './DIContainer';
import { InMemoryCache, CacheKeys } from '../cache/InMemoryCache';
import { Config, skyCorrectionMode } from '../config/config';
import { corregirCieloObservado } from './skyCorrectionRunner';
import { TieredCache } from '../cache/TieredCache';
import { UpstashRedisStore } from '../cache/UpstashRedisStore';
import { JsonBeachRepository } from '../repositories/JsonBeachRepository';
import { AemetWeatherProvider } from '../providers/AemetWeatherProvider';
import { OpenWeatherWeatherProvider } from '../providers/OpenWeatherWeatherProvider';
import { RedCrossFlagProvider } from '../providers/RedCrossFlagProvider';
import { FlagProviderRouter } from '../providers/FlagProviderRouter';
import { FlagProvider } from '../../domain/ports/FlagProvider';
import { FlagProviderId, FLAG_OPERATOR_NAMES } from '../../domain/entities/Flag';
import { regionRegistry, RegionConfig } from '../../regions';
import { GetAllBeaches } from '../../domain/use-cases/GetAllBeaches';
import { GetBeachById } from '../../domain/use-cases/GetBeachById';
import { GetBeachDetails } from '../../domain/use-cases/GetBeachDetails';
import { BeachConditions } from '../../domain/use-cases/BeachConditions';
import { DetailsAssembler } from '../../application/services/DetailsAssembler';
import { GetFeaturedBeaches } from '../../domain/use-cases/GetFeaturedBeaches';
import { GetRainNowcast } from '../../domain/use-cases/GetRainNowcast';
import { AemetBeachForecastProvider } from '../providers/AemetBeachForecastProvider';
import { AemetBeachWebScraper } from '../providers/AemetBeachWebScraper';
import { OpenMeteoPrecipitationProvider } from '../providers/OpenMeteoPrecipitationProvider';

/**
 * The app's cache: with Upstash configured (UPSTASH_REDIS_REST_URL/TOKEN) the
 * two-tier one is used, which survives sleep and Render free deploys.
 * Without those variables, exactly the usual in-memory one.
 */
export function crearCache(): InMemoryCache {
  const l2 = UpstashRedisStore.fromEnv();
  return l2 ? new TieredCache(l2) : new InMemoryCache();
}

export interface SharedDependencies {
  cache: InMemoryCache;
  aemetWeatherProvider: AemetWeatherProvider;
  openWeatherProvider: OpenWeatherWeatherProvider;
  aemetBeachForecastProvider: AemetBeachForecastProvider;
  aemetBeachWebScraper: AemetBeachWebScraper;
  openMeteoPrecipitationProvider: OpenMeteoPrecipitationProvider;
}

export function createSharedDependencies(
  cache = crearCache(),
  regions: RegionConfig[] = regionRegistry.all(),
): SharedDependencies {
  return {
    cache,
    aemetWeatherProvider: new AemetWeatherProvider(
      cache,
      regions.map((region) => region.observationBbox),
    ),
    openWeatherProvider: new OpenWeatherWeatherProvider(cache),
    aemetBeachForecastProvider: new AemetBeachForecastProvider(cache),
    aemetBeachWebScraper: new AemetBeachWebScraper(cache),
    openMeteoPrecipitationProvider: new OpenMeteoPrecipitationProvider(cache),
  };
}

export interface DependencyOverrides {
  cache?: InMemoryCache;
  /**
   * Required on purpose: a container is always bound to one region. Defaulting
   * this would let a caller silently build a container for whichever region
   * happened to load — resolve it explicitly at the call site instead.
   */
  region: RegionConfig;
  shared?: SharedDependencies;
}

export function configureDependencies(
  container: DIContainer,
  overrides: DependencyOverrides,
): void {
  const region = overrides.region;
  const shared = overrides.shared ?? createSharedDependencies(overrides.cache, regionRegistry.all());

  // Infrastructure Layer - Singletons
  container.registerInstance('cache', shared.cache);
  
  container.registerSingleton('beachRepository', (c) =>
    new JsonBeachRepository(c.get('cache'), region.catalogPath, region.id)
  );
  
  container.registerInstance('aemetWeatherProvider', shared.aemetWeatherProvider);
  
  container.registerInstance('openWeatherProvider', shared.openWeatherProvider);
  
  container.registerSingleton('redCrossFlagProvider', (c) =>
    new RedCrossFlagProvider(c.get('cache'), region.flagsPath, region.id)
  );

  // Neutral flag port: use cases depend on this router, never on a concrete
  // operator. The region declares which operators are active; new adapters
  // get added to this map, one line each.
  container.registerSingleton('flagProvider', (c) => {
    const adapters: Partial<Record<FlagProviderId, FlagProvider>> = {};
    if (region.flagProviders.includes('cruzroja')) {
      adapters.cruzroja = c.get('redCrossFlagProvider');
    }
    return new FlagProviderRouter(adapters);
  });

  container.registerInstance('aemetBeachForecastProvider', shared.aemetBeachForecastProvider);

  container.registerInstance('aemetBeachWebScraper', shared.aemetBeachWebScraper);

  container.registerInstance('openMeteoPrecipitationProvider', shared.openMeteoPrecipitationProvider);

  // Domain Layer - Use Cases
  container.register('getAllBeaches', (c) => 
    new GetAllBeaches(c.get('beachRepository'))
  );
  
  container.register('getBeachById', (c) => 
    new GetBeachById(c.get('beachRepository'))
  );
  
  container.register('getRainNowcast', (c) =>
    new GetRainNowcast(
      c.get('openWeatherProvider'),
      c.get('aemetWeatherProvider'),
      c.get('openMeteoPrecipitationProvider'),
      c.get('cache'),
      () => Config.cacheTtlSeconds(),
    )
  );

  // Conditions at a beach right now, shared by the ranking and the detail.
  container.register('beachConditions', (c) =>
    new BeachConditions(
      c.get('aemetWeatherProvider'),
      c.get('openWeatherProvider'),
      c.get('flagProvider'),
      c.get('getRainNowcast'),
      // Same object as 'aemetWeatherProvider': it also implements SunshineProvider.
      c.get('aemetWeatherProvider'),
      () => skyCorrectionMode() !== 'off',
      // Shared decision memory: whichever screen gets there first decides the
      // sky, and the other one shows the same.
      (name, weather, sunshine, raining, now, outlook) =>
        corregirCieloObservado(name, weather, sunshine, raining, now, outlook, c.get('cache'), region.id),
    )
  );

  container.register('getBeachDetails', (c) =>
    new GetBeachDetails(c.get('beachRepository'), c.get('beachConditions'))
  );

  container.register('getFeaturedBeaches', (c) =>
    new GetFeaturedBeaches(
      c.get('beachRepository'),
      c.get('aemetBeachForecastProvider'),
      c.get('cache'),
      c.get('beachConditions'),
      region.flagProviders.map((id) => FLAG_OPERATOR_NAMES[id]),
      {
        cacheKey: CacheKeys.featuredBeaches(region.id),
        freshTtlSeconds: () => Config.featuredFreshTtlSeconds(),
        staleTtlSeconds: () => Config.featuredStaleTtlSeconds(),
      },
    )
  );

  // Application Layer - Services
  container.register('detailsAssembler', (c) =>
    new DetailsAssembler(
      c.get('getBeachDetails'),
      c.get('aemetBeachWebScraper'),
      c.get('aemetBeachForecastProvider'),
      c.get('openWeatherProvider'),
      c.get('cache'),
      {
        cacheKey: (beachId) => CacheKeys.detailsByBeachId(region.id, beachId),
        freshTtlSeconds: () => Config.detailsFreshTtlSeconds(),
        staleTtlSeconds: () => Config.detailsStaleTtlSeconds(),
      },
      c.get('beachRepository'),
    )
  );
}

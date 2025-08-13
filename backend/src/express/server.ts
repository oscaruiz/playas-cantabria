import express, { Express } from 'express';
import compression from 'compression';
import { corsMiddleware } from './middlewares/cors';
import { errorHandler } from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFoundHandler';

import { InMemoryCache } from '../infrastructure/cache/InMemoryCache';
import { DIContainer } from '../infrastructure/di/DIContainer';
import { configureDependencies } from '../infrastructure/di/dependencies';

// Import types for better typing
import { GetAllBeaches } from '../domain/use-cases/GetAllBeaches';
import { GetBeachById } from '../domain/use-cases/GetBeachById';
import { LegacyDetailsAssembler } from '../application/services/LegacyDetailsAssembler';
import { WeatherProvider } from '../domain/ports/WeatherProvider';

import { createBeachesRouter } from './routes/beachesRouter';
// OJO: mantengo tu ruta actual del debugRouter
import { createDebugRouter } from '../infrastructure/express/routes/debugRouter';
import { DEBUG_WEATHER } from '../infrastructure/utils/debug';

export interface BuildDeps {
  /**
   * Provide a cache instance (shared across app).
   * If omitted, a new one will be constructed.
   */
  cache?: InMemoryCache;
}

/**
 * Build an Express app instance, wiring dependencies following Ports & Adapters.
 * This function is reusable from local index.ts and Firebase adapter.
 */
export function buildExpressApp({ cache }: BuildDeps = {}): Express {
  const app = express();

  // Middleware configuration
  app.use(compression());
  app.use(corsMiddleware());
  app.use(express.json());

  // 🏗️ DEPENDENCY INJECTION CONTAINER
  const container = new DIContainer();
  configureDependencies(container, { cache });

  // Get dependencies from container with proper typing
  const getAllBeaches = container.get<GetAllBeaches>('getAllBeaches');
  const getBeachById = container.get<GetBeachById>('getBeachById');
  const legacyDetailsAssembler = container.get<LegacyDetailsAssembler>('legacyDetailsAssembler');

  // Routes configuration
  app.use(
    '/api/beaches',
    createBeachesRouter({
      getAllBeaches,
      getBeachById,
      legacyDetailsAssembler,
    })
  );

  // Debug routes (conditional)
  if (DEBUG_WEATHER) {
    const aemet = container.get<WeatherProvider & { getLastRaw?: () => unknown }>('aemetWeatherProvider');
    const openWeather = container.get<WeatherProvider & { getLastRaw?: () => unknown }>('openWeatherProvider');

    app.use(
      '/api/_debug',
      createDebugRouter({
        getBeachById,
        aemet,
        openWeather,
      })
    );
  }

  // Error handling middleware (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

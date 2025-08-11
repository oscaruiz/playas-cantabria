import express, { Express } from 'express';
import { corsMiddleware } from './middlewares/cors';
import { errorHandler } from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFoundHandler';

import { InMemoryCache } from '../infrastructure/cache/InMemoryCache';
import { JsonBeachRepository } from '../infrastructure/repositories/JsonBeachRepository';
import { AemetWeatherProvider } from '../infrastructure/providers/AemetWeatherProvider';
import { OpenWeatherWeatherProvider } from '../infrastructure/providers/OpenWeatherWeatherProvider';
import { RedCrossFlagProvider } from '../infrastructure/providers/RedCrossFlagProvider';

import { GetAllBeaches } from '../domain/use-cases/GetAllBeaches';
import { GetBeachById } from '../domain/use-cases/GetBeachById';
import { GetBeachDetails } from '../domain/use-cases/GetBeachDetails';
import { DetailsAssembler } from '../application/services/DetailsAssembler';

import { createBeachesRouter } from './routes/beachesRouter';

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

  // Core middlewares
  app.use(corsMiddleware());
  app.use(express.json());

  // --- Infrastructure instances ---
  const sharedCache = cache ?? new InMemoryCache();

  const beachRepo = new JsonBeachRepository(sharedCache);
  const aemet = new AemetWeatherProvider(sharedCache);
  const openWeather = new OpenWeatherWeatherProvider(sharedCache);
  const redCross = new RedCrossFlagProvider(sharedCache);

  // --- Domain use-cases ---
  const getAllBeaches = new GetAllBeaches(beachRepo);
  const getBeachById = new GetBeachById(beachRepo);
  const getBeachDetails = new GetBeachDetails(beachRepo, aemet, openWeather, redCross, null);

  // --- Application services ---
  const detailsAssembler = new DetailsAssembler(getBeachDetails);

  // Routes
  app.use('/api/beaches', createBeachesRouter({ getAllBeaches, getBeachById, detailsAssembler }));

  // 404 + Errors
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

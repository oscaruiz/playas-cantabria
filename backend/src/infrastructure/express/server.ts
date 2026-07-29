import express, { Express } from 'express';
import compression from 'compression';
import { corsMiddleware } from './middlewares/cors';
import { errorHandler } from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFoundHandler';
import { rateLimit } from './middlewares/rateLimit';

import { InMemoryCache } from '../cache/InMemoryCache';
import { sembrarDesdeSnapshot } from '../cache/snapshotSeed';
import { DIContainer } from '../di/DIContainer';
import { configureDependencies } from '../di/dependencies';

// Import types for better typing
import { GetAllBeaches } from '../../domain/use-cases/GetAllBeaches';
import { GetBeachById } from '../../domain/use-cases/GetBeachById';
import { GetFeaturedBeaches } from '../../domain/use-cases/GetFeaturedBeaches';
import { LegacyDetailsAssembler } from '../../application/services/LegacyDetailsAssembler';
import { WeatherProvider } from '../../domain/ports/WeatherProvider';

import { createBeachesRouter } from './routes/beachesRouter';
import { createDebugRouter } from './routes/debugRouter';
import { createDiagRouter } from './routes/diagRouter';
import { RedCrossFlagProvider } from '../providers/RedCrossFlagProvider';
import { DEBUG_WEATHER } from '../utils/debug';

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

  // Render (y Firebase Functions) sirven detrás de un proxy: sin esto `req.ip`
  // devuelve la IP del proxy para TODO el mundo y el límite por IP se convertiría
  // en un límite global compartido. Se confía en un solo salto, no en toda la
  // cadena de X-Forwarded-For, que un cliente puede falsificar.
  app.set('trust proxy', 1);

  // Middleware configuration
  app.use(compression());
  app.use(corsMiddleware());
  app.use(express.json());

  // Request timeout: 15s max to prevent zombie requests
  app.use((_req, res, next) => {
    res.setTimeout(15000, () => {
      if (!res.headersSent) {
        res.status(504).json({ error: 'Request timeout' });
      }
    });
    next();
  });

  // 🏗️ DEPENDENCY INJECTION CONTAINER
  const container = new DIContainer();
  configureDependencies(container, { cache });

  // Get dependencies from container with proper typing
  const getAllBeaches = container.get<GetAllBeaches>('getAllBeaches');
  const getBeachById = container.get<GetBeachById>('getBeachById');
  const getFeaturedBeaches = container.get<GetFeaturedBeaches>('getFeaturedBeaches');
  const legacyDetailsAssembler = container.get<LegacyDetailsAssembler>('legacyDetailsAssembler');

  // Arranque en caliente: se siembra el agregado desde el snapshot de CI (como
  // STALE) para que el primer usuario tras un despliegue o tras el dormido de
  // Render no pague el fan-out completo a los proveedores.
  sembrarDesdeSnapshot(container.get<InMemoryCache>('cache'));

  // Warm the aggregate without delaying server startup. Subsequent refreshes
  // use stale-while-revalidate, so users do not pay the full provider fan-out.
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      void getFeaturedBeaches.execute(5).catch(() => undefined);
    }, 250);
  }

  // Protege la cuota gratuita de los proveedores frente a scrapers ajenos.
  // Una visita normal hace 2-3 peticiones; 60/min por IP no molesta a nadie real.
  app.use('/api', rateLimit({ ventanaMs: 60_000, maxPeticiones: 60 }));

  // Routes configuration
  app.use(
    '/api/beaches',
    createBeachesRouter({
      getAllBeaches,
      getBeachById,
      getFeaturedBeaches,
      legacyDetailsAssembler,
    })
  );

  // Diagnostics routes (ALWAYS on) — para depurar producción (Cruz Roja, commit vivo)
  app.use(
    '/api/_diag',
    createDiagRouter({
      flagProvider: container.get<RedCrossFlagProvider>('redCrossFlagProvider'),
      cache: container.get<InMemoryCache>('cache'),
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

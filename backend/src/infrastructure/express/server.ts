import express, { Express } from 'express';
import compression from 'compression';
import { corsMiddleware } from './middlewares/cors';
import { errorHandler } from './middlewares/errorHandler';
import { notFoundHandler } from './middlewares/notFoundHandler';
import { rateLimit } from './middlewares/rateLimit';
import { InMemoryCache } from '../cache/InMemoryCache';
import { sembrarDesdeSnapshot } from '../cache/snapshotSeed';
import { DIContainer } from '../di/DIContainer';
import { configureDependencies, createSharedDependencies } from '../di/dependencies';
import { GetAllBeaches } from '../../domain/use-cases/GetAllBeaches';
import { GetBeachById } from '../../domain/use-cases/GetBeachById';
import { GetFeaturedBeaches } from '../../domain/use-cases/GetFeaturedBeaches';
import { LegacyDetailsAssembler } from '../../application/services/LegacyDetailsAssembler';
import { createBeachesRouter } from './routes/beachesRouter';
import { createDebugRouter } from './routes/debugRouter';
import { createDiagRouter } from './routes/diagRouter';
import { RedCrossFlagProvider } from '../providers/RedCrossFlagProvider';
import { DEBUG_WEATHER } from '../utils/debug';
import { regionRegistry, RegionConfig } from '../../regions';

export interface BuildDeps {
  /** Shared cache override, primarily for tests. */
  cache?: InMemoryCache;
  /** Region override used by isolation tests; production loads the registry. */
  regions?: RegionConfig[];
}

/**
 * Ceiling on a single request. Exported because the shutdown deadline is
 * derived from it: closing the server for less than this would cut requests
 * that are still within their own budget.
 */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Builds one regional container per valid registry entry. External weather
 * providers and their coordinate-based cache are shared by every container.
 */
export function buildExpressApp({
  cache,
  regions = regionRegistry.all(),
}: BuildDeps = {}): Express {
  if (regions.length === 0) {
    throw new Error('Cannot start without at least one valid region');
  }
  const app = express();

  // Render and Firebase Functions serve behind one trusted proxy. Without this,
  // req.ip would be the proxy for every user and the per-IP limit would become
  // a shared global limit. Trust exactly one hop, not a client-forgeable chain.
  app.set('trust proxy', 1);
  app.use(compression());
  app.use(corsMiddleware());
  app.use(express.json());

  // Limit how long the client waits. This sends a 504 but does not cancel
  // provider requests already in flight; provider-level timeouts bound those.
  app.use((_req, res, next) => {
    res.setTimeout(REQUEST_TIMEOUT_MS, () => {
      if (!res.headersSent) {
        res.status(504).json({ error: 'Request timeout' });
      }
    });
    next();
  });

  const shared = createSharedDependencies(cache, regions);
  const containers = new Map<string, DIContainer>();

  for (const region of regions) {
    const container = new DIContainer();
    configureDependencies(container, { region, shared });
    containers.set(region.id, container);
    sembrarDesdeSnapshot(shared.cache, region);
  }

  // Protects the providers' free quota against third-party scrapers.
  // A normal visit makes 2-3 requests; 60/min per IP bothers no real user.
  app.use('/api', rateLimit({ ventanaMs: 60_000, maxPeticiones: 60 }));

  const routerFor = (container: DIContainer) => createBeachesRouter({
    getAllBeaches: container.get<GetAllBeaches>('getAllBeaches'),
    getBeachById: container.get<GetBeachById>('getBeachById'),
    getFeaturedBeaches: container.get<GetFeaturedBeaches>('getFeaturedBeaches'),
    legacyDetailsAssembler: container.get<LegacyDetailsAssembler>('legacyDetailsAssembler'),
  });

  for (const region of regions) {
    const container = containers.get(region.id)!;
    app.use(`/api/${region.id}/beaches`, routerFor(container));
  }

  // Installed clients still use /api/beaches. Keep it as a deprecated alias,
  // never as a fallback to whichever region happened to load.
  const cantabriaContainer = containers.get('cantabria');
  if (cantabriaContainer) {
    app.use(
      '/api/beaches',
      (req, res, next) => {
        res.setHeader('Deprecation', 'true');
        // The successor is the SAME resource under its region, not the
        // collection: from /api/beaches/:id/details the link has to land on
        // /api/cantabria/beaches/:id/details, or following it changes what you
        // asked for. Inside a mounted middleware `req.path` is already the
        // remainder after /api/beaches.
        const successor = `/api/cantabria/beaches${req.path === '/' ? '' : req.path}`;
        res.setHeader('Link', `<${successor}>; rel="successor-version"`);
        next();
      },
      routerFor(cantabriaContainer),
    );
  }

  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      // Preserve the historical Cantabria warm-up without multiplying its
      // provider fan-out by every region after each cron-triggered deployment.
      // Other regions revalidate their stale snapshot on their first read.
      if (cantabriaContainer) {
        void cantabriaContainer
          .get<GetFeaturedBeaches>('getFeaturedBeaches')
          .execute(5)
          .catch(() => undefined);
      }
    }, 250);
  }

  if (cantabriaContainer) {
    app.use(
      '/api/_diag',
      createDiagRouter({
        flagProvider: cantabriaContainer.get<RedCrossFlagProvider>('redCrossFlagProvider'),
        cache: shared.cache,
        probeToken: process.env.DIAG_PROBE_TOKEN?.trim() || undefined,
      }),
    );
  }

  if (DEBUG_WEATHER) {
    const debugContainer = cantabriaContainer ?? containers.values().next().value;
    if (debugContainer) {
      app.use(
        '/api/_debug',
        createDebugRouter({
          getBeachById: debugContainer.get<GetBeachById>('getBeachById'),
          aemet: shared.aemetWeatherProvider,
          openWeather: shared.openWeatherProvider,
        }),
      );
    }
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

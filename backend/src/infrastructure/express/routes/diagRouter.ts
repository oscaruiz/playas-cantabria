import { Router, Request, Response, NextFunction } from 'express';
import { RedCrossFlagProvider } from '../../providers/RedCrossFlagProvider';
import { InMemoryCache } from '../../cache/InMemoryCache';
import { httpMetrics } from '../../http/metrics';
import { hostLimiter } from '../../http/limiter';
import { skyCorrectionMetrics } from '../../observability/skyCorrectionMetrics';
import { probeProviders } from '../../observability/providerProbe';
import { enFranjaDePlaya, skyCorrectionMode } from '../../config/config';

export interface DiagRoutesDeps {
  flagProvider: RedCrossFlagProvider;
  cache?: InMemoryCache;
  probeToken?: string;
}

/**
 * /api/_diag/* — diagnostics ALWAYS on (without DEBUG_WEATHER).
 * - GET /api/_diag/version    -> deployed commit (Render) to know which build is live.
 * - GET /api/_diag/flag/:id   -> real result of the Cruz Roja scrape from the server.
 * - GET /api/_diag/metrics    -> external quota consumption + cache effectiveness.
 * - GET /api/_diag/sky        -> what the observed sky is (or would be) correcting.
 * - GET /api/_diag/providers  -> live probe of every provider from this IP.
 */
export function createDiagRouter(deps: DiagRoutesDeps): Router {
  const router = Router();

  router.get('/metrics', (_req: Request, res: Response) => {
    const mem = process.memoryUsage();
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      uptimeSegundos: Math.round(process.uptime()),
      memoria: {
        rssMB: Math.round(mem.rss / 1048576),
        heapUsadoMB: Math.round(mem.heapUsed / 1048576),
      },
      peticionesSalientes: httpMetrics.snapshot(),
      concurrenciaSaliente: hostLimiter.snapshot(),
      cache: deps.cache?.snapshot() ?? null,
      now: new Date().toISOString(),
    });
  });

  /**
   * Sky corrector based on observed insolation. In `shadow` mode the API
   * response does not change, so this endpoint is the ONLY way to see what
   * it would have done. It is checked against the webcams before turning it on.
   */
  router.get('/sky', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      modo: skyCorrectionMode(),
      enFranjaDePlaya: enFranjaDePlaya(),
      ...skyCorrectionMetrics.snapshot(),
      now: new Date().toISOString(),
    });
  });

  router.get('/version', (_req: Request, res: Response) => {
    res.json({
      commit: process.env.RENDER_GIT_COMMIT ?? null,
      node: process.version,
      proxy: process.env.SCRAPER_PROXY_URL ? 'configurado' : null,
      now: new Date().toISOString()
    });
  });

  router.get('/flag/:id', async (req: Request, res: Response, next: NextFunction) => {
    if (!deps.probeToken) return res.status(404).json({ error: 'Not found' });
    if (req.get('authorization') !== `Bearer ${deps.probeToken}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: 'invalid id' });
      }
      res.json(await deps.flagProvider.probe(id));
    } catch (e) {
      next(e);
    }
  });

  /**
   * Active probe of every provider, from this server's egress IP. It is the
   * only check that cannot approve without asking: `/metrics` describes the
   * traffic we happened to make, and an empty window looks identical to a
   * healthy one. Token-guarded like `/flag/:id` — it spends real requests
   * against the free tiers, so it is not something an anonymous caller gets
   * to trigger.
   */
  router.get('/providers', async (req: Request, res: Response, next: NextFunction) => {
    if (!deps.probeToken) return res.status(404).json({ error: 'Not found' });
    if (req.get('authorization') !== `Bearer ${deps.probeToken}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.json({ proveedores: await probeProviders(), now: new Date().toISOString() });
    } catch (e) {
      next(e);
    }
  });

  return router;
}

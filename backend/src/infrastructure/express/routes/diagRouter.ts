import { Router, Request, Response, NextFunction } from 'express';
import { RedCrossFlagProvider } from '../../providers/RedCrossFlagProvider';

export interface DiagRoutesDeps {
  flagProvider: RedCrossFlagProvider;
}

/**
 * /api/_diag/* — diagnóstico SIEMPRE activo (sin DEBUG_WEATHER).
 * - GET /api/_diag/version    -> commit desplegado (Render) para saber qué build vive.
 * - GET /api/_diag/flag/:id   -> resultado real del scrape de Cruz Roja desde el server.
 */
export function createDiagRouter(deps: DiagRoutesDeps): Router {
  const router = Router();

  router.get('/version', (_req: Request, res: Response) => {
    res.json({
      commit: process.env.RENDER_GIT_COMMIT ?? null,
      node: process.version,
      proxy: process.env.SCRAPER_PROXY_URL ? 'configurado' : null,
      now: new Date().toISOString()
    });
  });

  router.get('/flag/:id', async (req: Request, res: Response, next: NextFunction) => {
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

  return router;
}

import { Router, Request, Response, NextFunction } from 'express';
import { GetAllBeaches } from '../../../domain/use-cases/GetAllBeaches';
import { GetBeachById } from '../../../domain/use-cases/GetBeachById';
import { GetFeaturedBeaches } from '../../../domain/use-cases/GetFeaturedBeaches';
import { LegacyDetailsAssembler } from '../../../application/services/LegacyDetailsAssembler';
import { BeachMapper } from '../../../application/mappers/BeachMapper';
import { FeaturedBeachMapper } from '../../../application/mappers/FeaturedBeachMapper';
import { BeachIdSchema } from '../../../application/validation/params';

export interface BeachesRoutesDeps {
  getAllBeaches: GetAllBeaches;
  getBeachById: GetBeachById;
  getFeaturedBeaches?: GetFeaturedBeaches;
  legacyDetailsAssembler?: LegacyDetailsAssembler;
}

export function createBeachesRouter(deps: BeachesRoutesDeps): Router {
  const router = Router();
  const sendTimedJson = (
    res: Response,
    startedAt: number,
    cacheControl: string,
    body: unknown,
  ) => {
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('Server-Timing', `app;dur=${(performance.now() - startedAt).toFixed(1)}`);
    return res.json(body);
  };

  // GET /api/beaches
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    const startedAt = performance.now();
    try {
      const items = await deps.getAllBeaches.execute();
      const dto = BeachMapper.toDTOList(items);
      sendTimedJson(res, startedAt, 'public, max-age=300, stale-while-revalidate=86400', dto);
    } catch (e) {
      next(e);
    }
  });

  // GET /api/beaches/featured — MUST be before /:id to avoid route collision
  router.get('/featured', async (_req: Request, res: Response, next: NextFunction) => {
    const startedAt = performance.now();
    try {
      if (!deps.getFeaturedBeaches) {
        return res.status(500).json({ error: 'Featured beaches not configured' });
      }
      const { mejores, revisar, resumenTodas } = await deps.getFeaturedBeaches.execute(5);
      const dto = FeaturedBeachMapper.toDTO(mejores, revisar, resumenTodas, Date.now());
      sendTimedJson(res, startedAt, 'public, max-age=60, stale-while-revalidate=1800', dto);
    } catch (e) {
      next(e);
    }
  });

  // GET /api/beaches/:id
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    const startedAt = performance.now();
    try {
      const parsed = BeachIdSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid beach id' });
      }
      const beach = await deps.getBeachById.execute(parsed.data.id);
      sendTimedJson(
        res,
        startedAt,
        'public, max-age=300, stale-while-revalidate=86400',
        BeachMapper.toDTO(beach),
      );
    } catch (e) {
      next(e);
    }
  });

  // GET /api/beaches/:id/details  -> returns the LEGACY JSON
  router.get('/:id/details', async (req: Request, res: Response, next: NextFunction) => {
    const startedAt = performance.now();
    try {
      const parsed = BeachIdSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid beach id' });
      }
      if (!deps.legacyDetailsAssembler) {
        return res.status(500).json({ error: 'Details assembler not configured' });
      }
      const detailsDto = await deps.legacyDetailsAssembler.assemble(parsed.data.id);
      sendTimedJson(res, startedAt, 'public, max-age=60, stale-while-revalidate=300', detailsDto);
    } catch (e) {
      next(e);
    }
  });

  return router;
}

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

  // GET /api/beaches
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await deps.getAllBeaches.execute();
      const dto = BeachMapper.toDTOList(items);
      res.json(dto);
    } catch (e) {
      next(e);
    }
  });

  // GET /api/beaches/featured — MUST be before /:id to avoid route collision
  router.get('/featured', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (!deps.getFeaturedBeaches) {
        return res.status(500).json({ error: 'Featured beaches not configured' });
      }
      const { mejores, revisar, resumenTodas } = await deps.getFeaturedBeaches.execute(5);
      const dto = FeaturedBeachMapper.toDTO(mejores, revisar, resumenTodas, Date.now());
      res.json(dto);
    } catch (e) {
      next(e);
    }
  });

  // GET /api/beaches/:id
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = BeachIdSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid beach id' });
      }
      const beach = await deps.getBeachById.execute(parsed.data.id);
      res.json(BeachMapper.toDTO(beach));
    } catch (e) {
      next(e);
    }
  });

  // GET /api/beaches/:id/details  -> devuelve el JSON LEGADO
  router.get('/:id/details', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = BeachIdSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid beach id' });
      }
      if (!deps.legacyDetailsAssembler) {
        return res.status(500).json({ error: 'Details assembler not configured' });
      }
      const detailsDto = await deps.legacyDetailsAssembler.assemble(parsed.data.id);
      res.json(detailsDto);
    } catch (e) {
      next(e);
    }
  });

  return router;
}

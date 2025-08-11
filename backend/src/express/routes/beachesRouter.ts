import { Router, Request, Response, NextFunction } from 'express';
import { GetAllBeaches } from '../../domain/use-cases/GetAllBeaches';
import { GetBeachById } from '../../domain/use-cases/GetBeachById';
import { DetailsAssembler } from '../../application/services/DetailsAssembler';
import { BeachMapper } from '../../application/mappers/BeachMapper';
import { BeachIdSchema } from '../../application/validation/params';

export interface BeachesRoutesDeps {
  getAllBeaches: GetAllBeaches;
  getBeachById: GetBeachById;
  detailsAssembler: DetailsAssembler;
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

  // GET /api/beaches/:id/details
  router.get('/:id/details', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = BeachIdSchema.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid beach id' });
      }
      const detailsDto = await deps.detailsAssembler.getBeachWithDetails(parsed.data.id);
      res.json(detailsDto);
    } catch (e) {
      next(e);
    }
  });

  return router;
}

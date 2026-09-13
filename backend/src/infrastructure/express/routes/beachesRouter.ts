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
      const { mejores, revisar, resumenTodas, generadoEn } =
        await deps.getFeaturedBeaches.execute(5);
      // `generadoEn` and not the instant of this response: the cache answers
      // from a stale entry, so what is being sent can be much older than the
      // request that got it, and stamping it now was telling the app the
      // opposite.
      //
      // The fallback covers rankings that carry no instant, and there is
      // exactly one source of those left: an L2 (Upstash) entry written by a
      // build from before this field existed, which `TieredCache` reseeds
      // verbatim. It is bounded and self-healing — the entry lives at most one
      // stale window and the next recompute stamps it — and until then the
      // response behaves exactly as every response did before today. Deleting
      // the fallback would be worse than the hour it covers: the field would
      // arrive undefined and the app would lose the freshness warning instead.
      const dto = FeaturedBeachMapper.toDTO(
        mejores,
        revisar,
        resumenTodas,
        generadoEn ?? Date.now(),
      );
      // No stale window, and the SAME policy as `/details`: this is the sky
      // the home page and the map paint, and the detail one tap away paints
      // the other one. Half an hour here against five minutes there let the
      // phone's own http cache serve the listing a sky six times older than
      // the detail of the same beach — which is how they were caught
      // disagreeing, everything cloudy on the front page and right inside.
      //
      // Dropping the window rather than merely shortening it, because
      // stale-while-revalidate SHADOWS the service worker instead of helping
      // it. The worker's fetch goes through the http cache, so inside that
      // window the browser answers it with the stored body and revalidates on
      // its own behind: the fresh body it gets back updates the http cache and
      // NOTHING ELSE — no second response reaches the worker, so the copy it
      // stores, and the repaint it can announce, are the old one either way.
      // The app ends up with two layers serving stale data and only one of
      // them —the worker's— able to say so.
      //
      // The resilience it bought is not lost: the worker still keeps a day's
      // copy and still hands it over within three seconds. What it costs is
      // those seconds on a return visit between one and thirty minutes later,
      // which used to repaint instantly from the http cache. That is the
      // trade: a slower first paint against a sky that is not half an hour
      // old. Provider quota is unaffected either way — what shields AEMET and
      // OpenWeather is this server's cache, not the phone's.
      sendTimedJson(res, startedAt, 'public, max-age=60', dto);
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
      // Same policy as `/featured`, and it has to stay the same: these two
      // paint the same sky on two screens one tap apart, so any window one of
      // them tolerates and the other does not shows up as the screens
      // disagreeing. See the note on `/featured` for why the window is gone.
      sendTimedJson(res, startedAt, 'public, max-age=60', detailsDto);
    } catch (e) {
      next(e);
    }
  });

  return router;
}

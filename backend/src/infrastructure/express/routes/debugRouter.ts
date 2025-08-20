import { Router, Request, Response, NextFunction } from 'express';
import { GetBeachById } from '../../../domain/use-cases/GetBeachById';
import { WeatherProvider } from '../../../domain/ports/WeatherProvider';

export interface DebugRoutesDeps {
  getBeachById: GetBeachById;
  aemet: WeatherProvider & { getLastRaw?: () => unknown };
  openWeather: WeatherProvider & { getLastRaw?: () => unknown };
}

/**
 * /api/_debug/*
 * - GET /api/_debug/weather/:id  -> llama a ambos providers y devuelve mapped + raw
 */
export function createDebugRouter(deps: DebugRoutesDeps): Router {
  const router = Router();

  router.get('/weather/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const beachId = req.params.id;
      if (!beachId) {
        return res.status(400).json({ error: 'Beach ID is required' });
      }
      const beach = await deps.getBeachById.execute(beachId);

      const out: any = {
        beach: { id: beach.id, name: beach.name, lat: beach.latitude, lon: beach.longitude },
        aemet: {},
        openweather: {},
      };

      // AEMET
      try {
        const mapped = await deps.aemet.getCurrentByCoords(beach.latitude, beach.longitude);
        out.aemet = {
          ok: true,
          mapped,
          raw: deps.aemet.getLastRaw ? deps.aemet.getLastRaw() : null,
        };
      } catch (e: any) {
        out.aemet = {
          ok: false,
          error: e?.message || String(e),
          raw: deps.aemet.getLastRaw ? deps.aemet.getLastRaw() : null,
        };
      }

      // OpenWeather
      try {
        const mapped = await deps.openWeather.getCurrentByCoords(beach.latitude, beach.longitude);
        out.openweather = {
          ok: true,
          mapped,
          raw: deps.openWeather.getLastRaw ? deps.openWeather.getLastRaw() : null,
        };
      } catch (e: any) {
        out.openweather = {
          ok: false,
          error: e?.message || String(e),
          raw: deps.openWeather.getLastRaw ? deps.openWeather.getLastRaw() : null,
        };
      }

      res.json(out);
    } catch (e) {
      next(e);
    }
  });

  return router;
}

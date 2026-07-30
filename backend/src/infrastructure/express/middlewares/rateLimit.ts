import { Request, Response, NextFunction } from 'express';

/**
 * Per-IP request limit (fixed window, in memory).
 *
 * It does not aim to slow down users —a normal visit makes a handful of
 * requests— but to prevent a third-party scraper from consuming the free quota of
 * OpenWeather/AEMET, which is shared by everyone and does not recover until the next
 * month.
 *
 * No dependencies: one counter per IP is enough for a single process, which is
 * exactly what there is on Render free.
 */

export interface RateLimitOptions {
  ventanaMs?: number;
  maxPeticiones?: number;
  now?: () => number;
}

export function rateLimit({
  ventanaMs = 60_000,
  maxPeticiones = 60,
  now = () => Date.now(),
}: RateLimitOptions = {}) {
  let inicioVentana = now();
  let contadores = new Map<string, number>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ahora = now();
    if (ahora - inicioVentana >= ventanaMs) {
      inicioVentana = ahora;
      contadores = new Map(); // new window: the whole map is discarded
    }

    const ip = req.ip ?? req.socket?.remoteAddress ?? 'desconocida';
    const usadas = (contadores.get(ip) ?? 0) + 1;
    contadores.set(ip, usadas);

    if (usadas > maxPeticiones) {
      const restanteSeg = Math.ceil((inicioVentana + ventanaMs - ahora) / 1000);
      res.setHeader('Retry-After', String(restanteSeg));
      res.status(429).json({ error: 'Demasiadas peticiones, prueba en unos segundos' });
      return;
    }

    next();
  };
}

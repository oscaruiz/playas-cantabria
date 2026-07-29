import { Request, Response, NextFunction } from 'express';

/**
 * Límite de peticiones por IP (ventana fija, en memoria).
 *
 * No busca frenar a los usuarios —una visita normal hace un puñado de
 * peticiones— sino evitar que un scraper ajeno consuma la cuota gratuita de
 * OpenWeather/AEMET, que es compartida por todos y no se recupera hasta el mes
 * siguiente.
 *
 * Sin dependencias: un contador por IP basta para un solo proceso, que es
 * justo lo que hay en Render free.
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
      contadores = new Map(); // ventana nueva: se descarta el mapa entero
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

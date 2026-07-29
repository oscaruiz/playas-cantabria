import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ttlFactor, Config } from '../infrastructure/config/config';

/**
 * El factor se calcula en hora de Madrid (Render corre en UTC) y decide cuánta
 * cuota gratuita se gasta al día. Las fechas van en UTC explícito para que el
 * test no dependa de la zona horaria de la máquina.
 */
describe('ttlFactor — TTL adaptativo por hora y temporada', () => {
  it('no alarga el TTL en la franja de playa de temporada (12:00 Madrid, julio)', () => {
    expect(ttlFactor(new Date('2026-07-15T10:00:00Z'))).toBe(1); // 12:00 CEST
  });

  it('cuadruplica el TTL de madrugada en temporada (04:00 Madrid, agosto)', () => {
    expect(ttlFactor(new Date('2026-08-10T02:00:00Z'))).toBe(4); // 04:00 CEST
  });

  it('cuadruplica el TTL justo al cerrar la franja (21:00 Madrid, julio)', () => {
    expect(ttlFactor(new Date('2026-07-15T19:00:00Z'))).toBe(4); // 21:00 CEST
  });

  it('multiplica por 12 fuera de temporada aunque sea mediodía (enero)', () => {
    expect(ttlFactor(new Date('2026-01-15T12:00:00Z'))).toBe(12); // 13:00 CET
  });

  it('trata junio y septiembre como temporada, mayo y octubre no', () => {
    expect(ttlFactor(new Date('2026-06-01T10:00:00Z'))).toBe(1);
    expect(ttlFactor(new Date('2026-09-30T10:00:00Z'))).toBe(1);
    expect(ttlFactor(new Date('2026-05-31T10:00:00Z'))).toBe(12);
    expect(ttlFactor(new Date('2026-10-01T10:00:00Z'))).toBe(12);
  });
});

/**
 * Las previsiones (AEMET publica la de playa un par de veces al día) no deben
 * refrescarse al ritmo del nowcast de lluvia: era la mayor fuente de llamadas
 * desperdiciadas con CACHE_TTL_SECONDS=300.
 */
describe('forecastTtlSeconds — TTL largo para previsiones', () => {
  const original = process.env.CACHE_TTL_SECONDS;

  beforeEach(() => {
    process.env.CACHE_TTL_SECONDS = '300';
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CACHE_TTL_SECONDS;
    else process.env.CACHE_TTL_SECONDS = original;
  });

  it('siempre es al menos 6 veces el TTL de tiempo real', () => {
    expect(Config.forecastTtlSeconds()).toBeGreaterThanOrEqual(
      Config.providerTtlSeconds() * 6,
    );
  });

  it('nunca baja de 30 min ni pasa de 6 h, sea cual sea la configuración', () => {
    expect(Config.forecastTtlSeconds()).toBeGreaterThanOrEqual(1800);
    expect(Config.forecastTtlSeconds()).toBeLessThanOrEqual(21600);
  });

  it('deja una ventana stale que aguanta una caída larga de AEMET', () => {
    expect(Config.forecastStaleTtlSeconds()).toBe(Config.forecastTtlSeconds() * 4);
  });
});

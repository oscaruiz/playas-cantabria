import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import { once } from 'events';
import type { AddressInfo } from 'net';
import { createBeachesRouter } from '../infrastructure/express/routes/beachesRouter';
import type { GetAllBeaches } from '../domain/use-cases/GetAllBeaches';
import type { GetBeachById } from '../domain/use-cases/GetBeachById';
import type { GetFeaturedBeaches } from '../domain/use-cases/GetFeaturedBeaches';
import { FeaturedBeachMapper, FeaturedBeachResult } from '../application/mappers/FeaturedBeachMapper';
import { InMemoryCache, CacheKeys } from '../infrastructure/cache/InMemoryCache';
import type { Beach } from '../domain/entities/Beach';
import type { Weather } from '../domain/entities/Weather';
import type { FlagStatus } from '../domain/entities/Flag';

/**
 * `/featured` answers from a stale-while-revalidate cache, so what it sends can
 * be much older than the request that got it. It used to stamp `Date.now()` on
 * the way out, which made an hour-old ranking claim to be a second old — and
 * the front page, which already knows how to warn that what it paints is old,
 * could never tell.
 */

const BEACH: Beach = {
  id: '1', name: 'Playa Test', municipality: 'Test', aemetCode: '0001',
  latitude: 43.4, longitude: -4.0,
};

const WEATHER: Weather = {
  source: 'OpenWeather', timestamp: 1750000000000, temperatureC: 22,
  description: 'cielo claro', icon: '01d', precipitationMm: null,
  windSpeedMs: 3, windDirectionDeg: 180, humidityPct: 60, pressureHPa: 1015,
};

function resultado(over: Partial<FeaturedBeachResult> = {}): FeaturedBeachResult {
  return {
    beach: BEACH, weather: WEATHER, flag: null, score: 80,
    reason: '', downgradeReason: null, enrichment: null, ...over,
  };
}

const HORA_MS = 60 * 60 * 1000;

describe('el instante publicado por /featured', () => {
  it('es el del ensamblado, no el de la respuesta', () => {
    const ensamblado = Date.parse('2026-09-12T08:00:00.000Z');

    const dto = FeaturedBeachMapper.toDTO(
      [resultado()], [], [resultado()],
      ensamblado,
      ensamblado + HORA_MS, // se responde una hora más tarde, desde la caché
    );

    expect(dto.timestamp).toBe(ensamblado);
  });

  it('sobrevive dentro del valor cacheado a un acierto stale', async () => {
    let ahora = Date.parse('2026-09-12T08:00:00.000Z');
    const cache = new InMemoryCache(() => ahora);
    const compute = vi.fn(async () => ({
      mejores: [], revisar: [], resumenTodas: [], generadoEn: ahora,
    }));

    const primera = await cache.getOrSetStale(CacheKeys.featuredBeaches('cantabria'), 300, 3600, compute);
    expect(primera.generadoEn).toBe(ahora);

    // Veinte minutos después: fuera de la ventana fresca, dentro de la stale.
    const ensamblado = ahora;
    ahora += 20 * 60 * 1000;
    const segunda = await cache.getOrSetStale(CacheKeys.featuredBeaches('cantabria'), 300, 3600, compute);

    // Se sirve el ranking viejo, y dice que es viejo. Eso es lo que permite a
    // la portada avisar en vez de callarlo.
    expect(segunda.generadoEn).toBe(ensamblado);
    expect(ahora - (segunda.generadoEn as number)).toBe(20 * 60 * 1000);
  });

});

describe('una bandera caducada en una respuesta vieja', () => {
  it('no se republica como vigente', () => {
    const ensamblado = Date.parse('2026-09-12T08:00:00.000Z');
    // Capturada justo antes de ensamblar: vigente entonces, con 9 h ya no.
    const flag = {
      color: 'green', timestamp: ensamblado - 1000, schedule: null,
      coverageFrom: null, coverageTo: null,
    } as unknown as FlagStatus;

    const reciente = FeaturedBeachMapper.toDTO(
      [resultado({ flag })], [], [resultado({ flag })],
      ensamblado,
      ensamblado, // servida al momento
    );
    expect(reciente.playas[0].bandera).toBe('Verde');

    const vieja = FeaturedBeachMapper.toDTO(
      [resultado({ flag })], [], [resultado({ flag })],
      ensamblado,
      ensamblado + 9 * HORA_MS, // misma respuesta, nueve horas después
    );

    // La vigencia se juzga contra AHORA y no contra el ensamblado: si se
    // juzgara contra el ensamblado, seguiría diciendo "Verde" para siempre.
    // Son datos de socorrismo.
    expect(vieja.playas[0].bandera).toBeNull();
  });
});

/**
 * Through the endpoint and out to the JSON, because that is the only place the
 * two instants can be seen doing different jobs. Every step in between can be
 * broken on its own — the use case not stamping, the router going back to
 * `Date.now()` — and the response is what notices.
 */
async function pedirFeatured(ranking: unknown): Promise<Record<string, unknown>> {
  const app = express().use(
    '/api/beaches',
    createBeachesRouter({
      getAllBeaches: { execute: async () => [] } as unknown as GetAllBeaches,
      getBeachById: { execute: async () => undefined } as unknown as GetBeachById,
      getFeaturedBeaches: { execute: async () => ranking } as unknown as GetFeaturedBeaches,
    }),
  );
  const server = app.listen(0);
  await once(server, 'listening');
  try {
    const res = await fetch(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/beaches/featured`,
    );
    expect(res.status).toBe(200);
    return (await res.json()) as Record<string, unknown>;
  } finally {
    await new Promise((r) => server.close(r));
  }
}

describe('/featured publica los dos instantes', () => {
  it('saca el del ensamblado, no el de la respuesta', async () => {
    const ensamblado = Date.parse('2026-09-12T08:00:00.000Z');

    const cuerpo = await pedirFeatured({
      mejores: [], revisar: [], resumenTodas: [], generadoEn: ensamblado,
    });

    // Esto es lo que permite a la portada avisar de que lo pintado es viejo.
    expect(cuerpo.timestamp).toBe(ensamblado);
    // Y esto lo que permite al cliente desempatar dos respuestas del MISMO
    // ranking con las banderas juzgadas en momentos distintos.
    expect(cuerpo.servidoEn).toBeGreaterThan(ensamblado);
  });

  it('cae a ahora solo cuando el ranking no trae instante', async () => {
    const antes = Date.now();

    const cuerpo = await pedirFeatured({ mejores: [], revisar: [], resumenTodas: [] });

    expect(cuerpo.timestamp as number).toBeGreaterThanOrEqual(antes);
  });
});

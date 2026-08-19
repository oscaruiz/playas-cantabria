import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { createBeachesRouter } from '../infrastructure/express/routes/beachesRouter';
import { GetAllBeaches } from '../domain/use-cases/GetAllBeaches';
import { GetBeachById } from '../domain/use-cases/GetBeachById';
import { GetBeachDetails } from '../domain/use-cases/GetBeachDetails';
import { LegacyDetailsAssembler } from '../application/services/LegacyDetailsAssembler';
import type { Beach } from '../domain/entities/Beach';
import type { Weather } from '../domain/entities/Weather';
import type { FlagStatus } from '../domain/entities/Flag';
import type { BeachRepository } from '../domain/ports/BeachRepository';
import type { WeatherProvider } from '../domain/ports/WeatherProvider';
import type { FlagProvider } from '../domain/ports/FlagProvider';
import type { BeachFullForecast } from '../domain/entities/BeachForecast';
import type { AemetBeachWebScraper } from '../infrastructure/providers/AemetBeachWebScraper';
import type { AemetBeachForecastProvider } from '../infrastructure/providers/AemetBeachForecastProvider';
import type { OpenWeatherWeatherProvider } from '../infrastructure/providers/OpenWeatherWeatherProvider';
import type { GetRainNowcast } from '../domain/use-cases/GetRainNowcast';

// ---------------------------------------------------------------------------
// API contract snapshot.
//
// Mounts the real router + real use cases + real mappers/assembler, faking only
// the outer ports (repository, weather, flags, scrapers). Every fixture
// timestamp is fixed, so the full response body is deterministic and asserted
// with toEqual. If an internal refactor changes ANY field of the public API,
// these tests fail — that is their whole purpose. Do not loosen them to make
// a refactor pass; a diff here means the API contract changed.
// ---------------------------------------------------------------------------

const T = 1750000000000;
const T_ISO = '2025-06-15T15:06:40.000Z';

const BERRIA: Beach = {
  id: '3907990',
  name: 'Berria',
  municipality: 'Santoña',
  aemetCode: '3907990',
  latitude: 43.46,
  longitude: -3.46,
  flagRef: { provider: 'cruzroja', ref: 373 },
  flagStations: [
    { ref: { provider: 'cruzroja', ref: 101 }, sourceId: 101, sourceName: 'BERRIA 1' },
    { ref: { provider: 'cruzroja', ref: 102 }, sourceId: 102, sourceName: 'BERRIA 2' },
  ],
  attributes: { socorrismo: true, duchas: true },
  lengthM: 2000,
  webcam: { url: 'https://example.com/berria', cobertura: 'exacta' },
};

// No flag coverage, no webcam, scraper fails for it → exercises the fallbacks.
const COBRECES: Beach = {
  id: '3902401',
  name: 'Playa de Cóbreces',
  municipality: 'Alfoz de Lloredo',
  aemetCode: '3902401',
  latitude: 43.388,
  longitude: -4.214,
};

const OW_CURRENT: Weather = {
  source: 'OpenWeather',
  timestamp: T,
  temperatureC: 18,
  description: 'lluvia ligera',
  icon: '10d',
  precipitationMm: 0.5,
  windSpeedMs: 4,
  windDirectionDeg: 200,
  humidityPct: 80,
  pressureHPa: 1012,
};

// Two stations, green + red → the aggregated flag must be the red one.
const FLAGS: Record<number, FlagStatus> = {
  101: { color: 'green', timestamp: T, coverageFrom: '11:00', coverageTo: '19:00', schedule: '11:00 - 19:00' },
  102: { color: 'red', timestamp: T, coverageFrom: '11:00', coverageTo: '19:00', schedule: '11:00 - 19:00' },
};

// Complete halves (no gaps) so the OpenWeather gap-filling step stays idle.
const BERRIA_FORECAST: BeachFullForecast = {
  source: 'AEMET_XML',
  elaboration: '2026-06-17T09:00:00',
  warningZone: 'Litoral de Cantabria',
  days: [
    {
      date: '17',
      morning: { skyDescription: 'Muy nuboso', skyIconCode: 120, wind: 'flojo', waves: 'tranquilo' },
      afternoon: { skyDescription: 'Despejado', skyIconCode: 100, wind: 'moderado', waves: 'moderado' },
      maxTemperatureC: 22,
      thermalSensation: 'agradable',
      waterTemperatureC: 18,
      uvIndexMax: 6,
      uvLevel: 'alto',
      warning: null,
    },
  ],
  tides: [{ highTide: ['04:30', '16:50'], lowTide: ['10:40', '23:00'] }],
  tidesSource: '*Puerto de Santander',
};

function buildApp() {
  const repo: BeachRepository = {
    getAll: async () => [BERRIA, COBRECES],
    getById: async (id) => [BERRIA, COBRECES].find((b) => b.id === id) ?? null,
  };
  const aemetWeather: WeatherProvider = {
    getCurrentByCoords: async () => {
      throw new Error('AEMET observation down in this test');
    },
  };
  const openWeatherPort: WeatherProvider = {
    getCurrentByCoords: async () => OW_CURRENT,
  };
  const flagProvider: FlagProvider = {
    getFlag: async (ref) => FLAGS[ref.ref] ?? null,
  };
  const scraper = {
    getBeachForecast: async (code: string) => {
      if (code === BERRIA.aemetCode) return BERRIA_FORECAST;
      throw new Error('no AEMET beach sheet in this test');
    },
    getCachedTides: () => null,
  } as unknown as AemetBeachWebScraper;
  const aemetPlayas = {
    getByBeachCode: async () => {
      throw new Error('OpenData API down in this test');
    },
  } as unknown as AemetBeachForecastProvider;
  const openWeatherProvider = {
    getCurrentByCoords: async () => OW_CURRENT,
    getTomorrowByCoords: async () => {
      throw new Error('skip');
    },
    getDailyUVIndex: async () => {
      throw new Error('skip');
    },
    getCloudinessTodayAndTomorrow: async () => {
      throw new Error('skip');
    },
    getForecastHalfDays: async () => [],
  } as unknown as OpenWeatherWeatherProvider;
  const rainNowcast = {
    execute: async () => {
      throw new Error('rain nowcast unavailable in this test');
    },
  } as unknown as GetRainNowcast;

  const getBeachDetails = new GetBeachDetails(repo, aemetWeather, openWeatherPort, flagProvider, null);
  // No cache, no sunshine provider: assembleFresh on every request, no sky correction.
  const assembler = new LegacyDetailsAssembler(
    getBeachDetails,
    scraper,
    aemetPlayas,
    openWeatherProvider,
    rainNowcast,
  );

  const app = express();
  app.use(
    '/api/beaches',
    createBeachesRouter({
      getAllBeaches: new GetAllBeaches(repo),
      getBeachById: new GetBeachById(repo),
      legacyDetailsAssembler: assembler,
    }),
  );
  return app;
}

const BERRIA_LIST_DTO = {
  nombre: 'Berria',
  municipio: 'Santoña',
  codigo: '3907990',
  lat: 43.46,
  lon: -3.46,
  idCruzRoja: 373,
  cruzRojaStations: [
    { id: 101, nombreFuente: 'BERRIA 1' },
    { id: 102, nombreFuente: 'BERRIA 2' },
  ],
  fuenteBanderas: 'Cruz Roja',
  atributos: { socorrismo: true, duchas: true },
  longitud: 2000,
  webcam: { url: 'https://example.com/berria', cobertura: 'exacta' },
};

const COBRECES_LIST_DTO = {
  nombre: 'Playa de Cóbreces',
  municipio: 'Alfoz de Lloredo',
  codigo: '3902401',
  lat: 43.388,
  lon: -4.214,
  idCruzRoja: 0,
  // Explicit null, never absent: it is what tells a client "nobody watches
  // this beach" apart from "this backend does not report the operator".
  fuenteBanderas: null,
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = buildApp().listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('API contract — GET /api/beaches', () => {
  it('returns the exact list shape (Spanish keys, idCruzRoja, optional fields omitted)', async () => {
    const res = await fetch(`${baseUrl}/api/beaches`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=300, stale-while-revalidate=86400');
    expect(await res.json()).toEqual([BERRIA_LIST_DTO, COBRECES_LIST_DTO]);
  });
});

describe('API contract — GET /api/beaches/:id', () => {
  it('returns the exact single-beach shape', async () => {
    const res = await fetch(`${baseUrl}/api/beaches/3907990`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(BERRIA_LIST_DTO);
  });
});

describe('API contract — GET /api/beaches/:id/details', () => {
  it('returns the exact details shape when everything works (AEMET sheet + multi-station flag)', async () => {
    const res = await fetch(`${baseUrl}/api/beaches/3907990/details`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=60, stale-while-revalidate=300');
    expect(await res.json()).toEqual({
      nombre: 'Berria',
      municipio: 'Santoña',
      codigo: '3907990',
      lat: 43.46,
      lon: -3.46,
      atributos: { socorrismo: true, duchas: true },
      longitud: 2000,
      anchura: null,
      tipoPlaya: null,
      arena: null,
      acceso: null,
      parkingDescripcion: null,
      bus: null,
      hospitalDistancia: null,
      submarinismo: null,
      webcam: { url: 'https://example.com/berria', cobertura: 'exacta' },
      banderaAzul: null,
      temperaturaActual: 18,
      tiempoActual: {
        cielo: 'lluvia ligera',
        icono: 200,
        temperatura: 18,
        precipitacionMm: 0.5,
        fuente: 'OpenWeather',
        // The provider's own day/night call, from the `n` suffix on its icon.
        esNoche: false,
        timestamp: T_ISO,
      },
      clima: {
        fuente: 'AEMET',
        ultimaActualizacion: '2026-06-17T09:00:00',
        hoy: {
          summary: 'Muy nuboso',
          temperature: 22,
          waterTemperature: 18,
          sensation: 'agradable',
          wind: 'flojo',
          waves: 'tranquilo',
          uvIndex: 6,
          icon: 120,
          // No `estimados`: AEMET reported sensation, wind, waves, water and
          // UV, so nothing here was derived by us.
        },
        manana: null,
      },
      fuenteBanderas: 'Cruz Roja',
      cruzRoja: {
        bandera: 'Roja',
        coberturaDesde: '11:00',
        coberturaHasta: '19:00',
        horario: '11:00 - 19:00',
        ultimaActualizacion: T_ISO,
      },
      prediccionCompleta: {
        fuente: 'AEMET_XML',
        elaboracion: '2026-06-17T09:00:00',
        zonaAvisos: 'Litoral de Cantabria',
        dias: [
          {
            fecha: '17',
            manana: { cielo: 'Muy nuboso', iconoCielo: 120, viento: 'flojo', oleaje: 'tranquilo' },
            tarde: { cielo: 'Despejado', iconoCielo: 100, viento: 'moderado', oleaje: 'moderado' },
            temperaturaMaxima: 22,
            sensacionTermica: 'agradable',
            temperaturaAgua: 18,
            indiceUV: 6,
            nivelUV: 'alto',
            aviso: null,
          },
        ],
        mareas: [{ pleamar: ['04:30', '16:50'], bajamar: ['10:40', '23:00'] }],
        fuenteMareas: '*Puerto de Santander',
      },
      // When the backend ASSEMBLED this, which is not when it served it: the
      // endpoint answers from a stale-while-revalidate cache.
      generadoEn: expect.any(String),
    });
  });

  it('returns the exact details shape on the fallback path (no AEMET sheet, no flag coverage)', async () => {
    const res = await fetch(`${baseUrl}/api/beaches/3902401/details`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      nombre: 'Playa de Cóbreces',
      municipio: 'Alfoz de Lloredo',
      codigo: '3902401',
      lat: 43.388,
      lon: -4.214,
      atributos: null,
      longitud: null,
      anchura: null,
      tipoPlaya: null,
      arena: null,
      acceso: null,
      parkingDescripcion: null,
      bus: null,
      hospitalDistancia: null,
      submarinismo: null,
      webcam: null,
      banderaAzul: null,
      temperaturaActual: 18,
      tiempoActual: {
        cielo: 'lluvia ligera',
        icono: 200,
        temperatura: 18,
        precipitacionMm: 0.5,
        fuente: 'OpenWeather',
        // The provider's own day/night call, from the `n` suffix on its icon.
        esNoche: false,
        timestamp: T_ISO,
      },
      clima: {
        fuente: 'OpenWeather',
        ultimaActualizacion: T_ISO,
        hoy: {
          summary: 'Lluvia ligera',
          temperature: 18,
          waterTemperature: 22,
          sensation: 'agradable',
          wind: 'flojo',
          waves: 'moderado',
          uvIndex: null,
          icon: 200,
          // Nobody reported these three: the sensation comes from the
          // temperature, the waves from the wind and the water is the default.
          // Without this list they would look measured on screen.
          estimados: ['sensacion', 'oleaje', 'agua'],
        },
        manana: null,
      },
      // No station in the catalog → no operator watches it. The pair
      // (null, null) is the "no flag service here" state.
      fuenteBanderas: null,
      cruzRoja: null,
      prediccionCompleta: null,
      generadoEn: expect.any(String),
    });
  });
});

import { describe, it, expect } from 'vitest';
import { LegacyDetailsAssembler } from '../application/services/LegacyDetailsAssembler';
import type { GetBeachDetails, BeachDetails } from '../domain/use-cases/GetBeachDetails';
import type { AemetBeachWebScraper } from '../infrastructure/providers/AemetBeachWebScraper';
import type { AemetBeachForecastProvider } from '../infrastructure/providers/AemetBeachForecastProvider';
import type { OpenWeatherWeatherProvider } from '../infrastructure/providers/OpenWeatherWeatherProvider';
import type { GetRainNowcast } from '../domain/use-cases/GetRainNowcast';
import type { Beach } from '../domain/entities/Beach';
import type { Weather } from '../domain/entities/Weather';
import type { RainNowcast } from '../domain/entities/RainNowcast';
import type { BeachFullForecast } from '../domain/entities/BeachForecast';

// ---------------------------------------------------------------------------
// Fixtures — Cóbreces-like payload: TODAY's MORNING and AFTERNOON disagree.
// It is exactly the bug case: the "Hoy" hero used to headline with the AFTERNOON
// ("Despejado") while the MORNING block showed "Muy nuboso".
// ---------------------------------------------------------------------------

const COBRECES: Beach = {
  id: '3902401',
  name: 'Playa de Cóbreces',
  municipality: 'Alfoz de Lloredo',
  aemetCode: '3902401',
  latitude: 43.388,
  longitude: -4.214,
};

const half = (over: Partial<BeachFullForecast['days'][number]['morning']> = {}) => ({
  skyDescription: null,
  skyIconCode: null,
  wind: null,
  waves: null,
  ...over,
});

function makeForecast(): BeachFullForecast {
  return {
    source: 'AEMET_XML',
    elaboration: '2026-06-17T09:00:00',
    warningZone: null,
    days: [
      {
        date: '17',
        morning: half({ skyDescription: 'Muy nuboso', skyIconCode: 120 }),
        afternoon: half({ skyDescription: 'Despejado', skyIconCode: 100 }),
        maxTemperatureC: 22,
        thermalSensation: null,
        waterTemperatureC: 18,
        uvIndexMax: 6,
        uvLevel: 'alto',
        warning: null,
      },
    ],
    tides: [],
    tidesSource: null,
  };
}

function makeOwCurrent(over: Partial<Weather> = {}): Weather {
  return {
    source: 'OpenWeather',
    timestamp: 1750000000000,
    temperatureC: 18,
    description: 'lluvia ligera',
    icon: '10d',
    precipitationMm: 0.5,
    windSpeedMs: 4,
    windDirectionDeg: 200,
    humidityPct: 80,
    pressureHPa: 1012,
    ...over,
  };
}

function buildAssembler(opts: {
  details: BeachDetails;
  forecast: BeachFullForecast | null;
  owCurrent: Weather | (() => Promise<Weather>);
  rain?: RainNowcast | (() => Promise<RainNowcast>);
  owHalfDays?: Array<{ manana: any; tarde: any }>;
}) {
  const getDetails = {
    execute: async () => opts.details,
  } as unknown as GetBeachDetails;

  const aemetScraper = {
    getBeachForecast: async () => {
      if (!opts.forecast) throw new Error('scraper failed');
      return opts.forecast;
    },
    getCachedTides: () => null,
  } as unknown as AemetBeachWebScraper;

  const aemetPlayas = {
    getByBeachCode: async () => {
      throw new Error('not used when scraper succeeds');
    },
  } as unknown as AemetBeachForecastProvider;

  const openWeather = {
    getCurrentByCoords: async () =>
      typeof opts.owCurrent === 'function' ? opts.owCurrent() : opts.owCurrent,
    // The later enrichments are not relevant for this test: they fail softly.
    getTomorrowByCoords: async () => {
      throw new Error('skip');
    },
    getDailyUVIndex: async () => {
      throw new Error('skip');
    },
    getCloudinessTodayAndTomorrow: async () => {
      throw new Error('skip');
    },
    getForecastHalfDays: async () => opts.owHalfDays ?? [],
  } as unknown as OpenWeatherWeatherProvider;

  const rainNowcast = {
    execute: async () => {
      if (!opts.rain) throw new Error('rain nowcast unavailable');
      return typeof opts.rain === 'function' ? opts.rain() : opts.rain;
    },
  } as unknown as GetRainNowcast;

  return new LegacyDetailsAssembler(getDetails, aemetScraper, aemetPlayas, openWeather, rainNowcast);
}

describe('LegacyDetailsAssembler — coherencia resumen vs desglose y "ahora" real', () => {
  it('reproduce la discrepancia mañana/tarde en la previsión (origen único, no bug de caché)', async () => {
    const assembler = buildAssembler({
      details: { beach: COBRECES, weather: makeOwCurrent(), flag: null, tides: null },
      forecast: makeForecast(),
      owCurrent: makeOwCurrent(),
    });

    const result = await assembler.assemble(COBRECES.id);

    const hoy = result.prediccionCompleta?.dias[0];
    expect(hoy?.manana.cielo).toBe('Muy nuboso');
    expect(hoy?.tarde.cielo).toBe('Despejado');
    // The old hero headlined with `tarde.cielo` → "Despejado", contradicting
    // the MORNING block ("Muy nuboso"). Both come from the SAME object/request.
    expect(hoy?.manana.cielo).not.toBe(hoy?.tarde.cielo);
  });

  it('puebla tiempoActual desde OpenWeather current (observación real con prioridad)', async () => {
    const assembler = buildAssembler({
      details: { beach: COBRECES, weather: makeOwCurrent(), flag: null, tides: null },
      forecast: makeForecast(),
      owCurrent: makeOwCurrent({ description: 'lluvia ligera', icon: '10d', precipitationMm: 0.5 }),
    });

    const result = await assembler.assemble(COBRECES.id);

    expect(result.tiempoActual).not.toBeNull();
    expect(result.tiempoActual?.cielo).toBe('lluvia ligera');
    expect(result.tiempoActual?.precipitacionMm).toBe(0.5);
    expect(result.tiempoActual?.fuente).toBe('OpenWeather');
    expect(result.tiempoActual?.icono).toBe(200); // '10d' → rain

    // The AEMET forecast (breakdown) remains intact as future segments.
    expect(result.prediccionCompleta?.dias[0].tarde.cielo).toBe('Despejado');
  });

  it('adjunta la señal de lluvia agregada a tiempoActual sin tocar los campos existentes', async () => {
    const rain: RainNowcast = {
      status: 'raining',
      precipitationMm: 0.8,
      lastHourOnly: false,
      sources: [
        { source: 'OpenMeteo', precipitating: true, precipitationMm: 0.8, lastHour: false, timestamp: 1750000000000 },
        { source: 'OpenWeather', precipitating: false, precipitationMm: null, lastHour: false, timestamp: 1750000000000 },
      ],
      timestamp: 1750000000000,
    };
    const assembler = buildAssembler({
      details: { beach: COBRECES, weather: makeOwCurrent(), flag: null, tides: null },
      forecast: makeForecast(),
      owCurrent: makeOwCurrent(),
      rain,
    });

    const result = await assembler.assemble(COBRECES.id);

    expect(result.tiempoActual?.lluvia?.estado).toBe('lloviendo');
    expect(result.tiempoActual?.lluvia?.mm).toBe(0.8);
    expect(result.tiempoActual?.lluvia?.ultimaHora).toBe(false);
    expect(result.tiempoActual?.lluvia?.fuentes).toEqual(['OpenMeteo', 'OpenWeather']);
    // Pre-existing fields intact (additive contract).
    expect(result.tiempoActual?.cielo).toBe('lluvia ligera');
    expect(result.tiempoActual?.precipitacionMm).toBe(0.5);
    expect(result.tiempoActual?.fuente).toBe('OpenWeather');
  });

  it('si el nowcast de lluvia falla, el endpoint sigue intacto y tiempoActual va sin lluvia', async () => {
    const assembler = buildAssembler({
      details: { beach: COBRECES, weather: makeOwCurrent(), flag: null, tides: null },
      forecast: makeForecast(),
      owCurrent: makeOwCurrent(),
      // no opts.rain → the fake throws, like a downed provider
    });

    const result = await assembler.assemble(COBRECES.id);

    expect(result.tiempoActual).not.toBeNull();
    expect(result.tiempoActual?.lluvia).toBeUndefined();
    expect(result.tiempoActual?.cielo).toBe('lluvia ligera');
    expect(result.prediccionCompleta?.dias[0].tarde.cielo).toBe('Despejado');
  });

  it('lluvia PREVISTA por Open-Meteo: prevista con hora estimada y fuente OpenMeteo', async () => {
    const rain: RainNowcast = {
      status: 'dry',
      precipitationMm: 0,
      lastHourOnly: false,
      sources: [
        { source: 'OpenMeteo', precipitating: false, precipitationMm: 0, lastHour: false, timestamp: 1750000000000 },
      ],
      timestamp: 1750000000000,
      upcoming: { expected: true, firstAt: 1750003600000, mmMax: 0.6 },
    };
    const assembler = buildAssembler({
      details: { beach: COBRECES, weather: makeOwCurrent(), flag: null, tides: null },
      forecast: makeForecast(), // no rain text: only Open-Meteo triggers
      owCurrent: makeOwCurrent(),
      rain,
    });

    const result = await assembler.assemble(COBRECES.id);

    expect(result.tiempoActual?.lluvia?.estado).toBe('sin_lluvia');
    expect(result.tiempoActual?.lluvia?.prevista).toEqual({
      desdeIso: new Date(1750003600000).toISOString(),
      mm: 0.6,
      fuentes: ['OpenMeteo'],
    });
  });

  it('lluvia PREVISTA solo por texto AEMET (nowcast caído): sin hora y contenedor sintetizado', async () => {
    const forecast = makeForecast();
    forecast.days[0].afternoon.skyDescription = 'Chubascos tormentosos';
    const assembler = buildAssembler({
      details: { beach: COBRECES, weather: makeOwCurrent(), flag: null, tides: null },
      forecast,
      owCurrent: makeOwCurrent(),
      // no opts.rain → the nowcast throws; only the AEMET text remains
    });

    const result = await assembler.assemble(COBRECES.id);

    expect(result.tiempoActual?.lluvia?.estado).toBe('desconocido');
    expect(result.tiempoActual?.lluvia?.prevista).toEqual({
      desdeIso: null,
      mm: null,
      fuentes: ['AEMET'],
    });
  });

  it('sin previsión de lluvia (tramos secos y cielos sin lluvia) → prevista ausente', async () => {
    const rain: RainNowcast = {
      status: 'dry',
      precipitationMm: 0,
      lastHourOnly: false,
      sources: [],
      timestamp: 1750000000000,
      upcoming: { expected: false, firstAt: null, mmMax: null },
    };
    const assembler = buildAssembler({
      details: { beach: COBRECES, weather: makeOwCurrent(), flag: null, tides: null },
      forecast: makeForecast(),
      owCurrent: makeOwCurrent(),
      rain,
    });

    const result = await assembler.assemble(COBRECES.id);

    expect(result.tiempoActual?.lluvia?.prevista).toBeUndefined();
  });

  it('playa sinAemet: NO llama al scraper ni a la API de playas de AEMET (sin llamadas inválidas)', async () => {
    let scraperCalls = 0;
    let playasCalls = 0;
    const beachSinAemet: Beach = { ...COBRECES, id: '3907595', aemetCode: '3907595', sinAemet: true };

    const getDetails = {
      execute: async () => ({ beach: beachSinAemet, weather: makeOwCurrent(), flag: null, tides: null }),
    } as unknown as GetBeachDetails;
    const aemetScraper = {
      // getBeachForecast is the network request that must NOT fire for sinAemet.
      getBeachForecast: async () => { scraperCalls++; throw new Error('no debería llamarse'); },
      // getCachedTides is an in-memory cache read (no network) → allowed.
      getCachedTides: () => null,
    } as unknown as AemetBeachWebScraper;
    const aemetPlayas = {
      getByBeachCode: async () => { playasCalls++; throw new Error('no debería llamarse'); },
    } as unknown as AemetBeachForecastProvider;
    const openWeather = {
      getCurrentByCoords: async () => makeOwCurrent(),
      getTomorrowByCoords: async () => { throw new Error('skip'); },
      getDailyUVIndex: async () => { throw new Error('skip'); },
      getCloudinessTodayAndTomorrow: async () => { throw new Error('skip'); },
    } as unknown as OpenWeatherWeatherProvider;
    const rainNowcast = { execute: async () => { throw new Error('skip'); } } as unknown as GetRainNowcast;

    const assembler = new LegacyDetailsAssembler(getDetails, aemetScraper, aemetPlayas, openWeather, rainNowcast);
    const result = await assembler.assemble(beachSinAemet.id);

    expect(scraperCalls).toBe(0);
    expect(playasCalls).toBe(0);
    // Still works: weather via OpenWeather, no faked AEMET forecast.
    expect(result.clima).not.toBeNull();
    expect(result.prediccionCompleta).toBeNull();
  });

  it('no confía en cielo sintético de AEMET: tiempoActual = null si OpenWeather falla y el hedge es AEMET', async () => {
    const aemetSynthetic = makeOwCurrent({ source: 'AEMET', description: 'Templado y húmedo' });
    const assembler = buildAssembler({
      details: { beach: COBRECES, weather: aemetSynthetic, flag: null, tides: null },
      forecast: makeForecast(),
      owCurrent: async () => {
        throw new Error('OpenWeather down');
      },
    });

    const result = await assembler.assemble(COBRECES.id);

    expect(result.tiempoActual).toBeNull();
  });

  it('rellena cielo/viento/oleaje vacíos de AEMET ("nd") con OpenWeather, sin pisar lo que AEMET sí trae', async () => {
    // AEMET today: sky/wind/waves empty (nd→null) but with real temperature.
    const forecast: BeachFullForecast = {
      source: 'AEMET_XML',
      elaboration: '2026-07-24T06:00:00',
      warningZone: 'Litoral cántabro',
      days: [
        {
          date: 'viernes 24',
          morning: half(), // all null (nd)
          afternoon: half({ skyDescription: 'Despejado' }), // AEMET DOES carry the afternoon
          maxTemperatureC: 24,
          thermalSensation: null,
          waterTemperatureC: 24,
          uvIndexMax: 7,
          uvLevel: 'alto',
          warning: null,
        },
      ],
      tides: [],
      tidesSource: null,
    };
    const assembler = buildAssembler({
      details: { beach: COBRECES, weather: makeOwCurrent(), flag: null, tides: null },
      forecast,
      owCurrent: makeOwCurrent(),
      owHalfDays: [
        {
          manana: { descripcion: 'nubes dispersas', iconOw: '03d', vientoMs: 8 },
          tarde: { descripcion: 'cielo claro', iconOw: '01d', vientoMs: 4 },
        },
      ],
    });

    const dia = (await assembler.assemble(COBRECES.id)).prediccionCompleta!.dias[0];
    // Morning was empty → it is filled in with OpenWeather (capitalized).
    expect(dia.manana.cielo).toBe('Nubes dispersas');
    expect(dia.manana.viento).toBe('moderado'); // guessWind(8 m/s)
    expect(dia.manana.oleaje).toBe('agitado'); // wavesFromWind(8 m/s = 28.8 km/h)
    // Afternoon comes from AEMET → NOT overwritten.
    expect(dia.tarde.cielo).toBe('Despejado');
    // AEMET numeric data intact.
    expect(dia.temperaturaMaxima).toBe(24);
    expect(dia.temperaturaAgua).toBe(24);
    expect(dia.indiceUV).toBe(7);
  });
});

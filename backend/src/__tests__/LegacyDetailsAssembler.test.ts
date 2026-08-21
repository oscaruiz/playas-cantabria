import { describe, it, expect, vi, afterEach } from 'vitest';
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
import type { BeachRepository } from '../domain/ports/BeachRepository';

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
  /** OpenWeather's own slots — the source that stands in when Open-Meteo is silent. */
  owOutlook?: any[] | (() => Promise<any[]>);
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
    getOutlookSlots: async () =>
      typeof opts.owOutlook === 'function' ? opts.owOutlook() : opts.owOutlook ?? [],
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

// ---------------------------------------------------------------------------
// Marea de referencia — a beach with no AEMET sheet borrows the nearest
// beach's tide table. Coordinates approximate Langre/Somo/Sardinero, real
// distances on this stretch of coast.
// ---------------------------------------------------------------------------

describe('LegacyDetailsAssembler — marea de referencia', () => {
  const DONOR: Beach = {
    id: 'donor-1',
    name: 'Somo',
    municipality: 'Ribamontán al Mar',
    aemetCode: 'donor-1',
    latitude: 43.4584,
    longitude: -3.7352,
  };

  const FAR_DONOR: Beach = {
    id: 'donor-2',
    name: 'Sardinero',
    municipality: 'Santander',
    aemetCode: 'donor-2',
    latitude: 43.4771,
    longitude: -3.7871,
  };

  const NO_TIDES: Beach = {
    id: 'sin-mareas',
    name: 'Langre',
    municipality: 'Ribamontán al Mar',
    aemetCode: 'sin-mareas',
    sinAemet: true,
    latitude: 43.462,
    longitude: -3.73,
  };

  const donorForecast = (): BeachFullForecast => ({
    source: 'AEMET_HTML',
    elaboration: null,
    warningZone: null,
    days: [],
    tides: [{ highTide: ['09:00', '21:00'], lowTide: ['03:00', '15:00'] }],
    tidesSource: '*Fuente: IHM',
  });

  function build(opts: {
    beach: Beach;
    catalog: Beach[];
    donorForecast?: BeachFullForecast;
    donorCachedTides?: { tides: BeachFullForecast['tides']; tidesSource: string | null } | null;
    withRepo?: boolean;
  }) {
    const getDetails = {
      execute: async () => ({ beach: opts.beach, weather: makeOwCurrent(), flag: null, tides: null }),
    } as unknown as GetBeachDetails;

    const aemetScraper = {
      getBeachForecast: async (codigo: string) => {
        if (codigo !== DONOR.aemetCode && codigo !== FAR_DONOR.aemetCode) {
          throw new Error(`getBeachForecast llamado con código inesperado: ${codigo}`);
        }
        if (!opts.donorForecast) throw new Error('donor scrape failed');
        return opts.donorForecast;
      },
      getCachedTides: () => opts.donorCachedTides ?? null,
    } as unknown as AemetBeachWebScraper;

    const aemetPlayas = {
      getByBeachCode: async () => { throw new Error('not used'); },
    } as unknown as AemetBeachForecastProvider;

    const openWeather = {
      getCurrentByCoords: async () => makeOwCurrent(),
      getTomorrowByCoords: async () => { throw new Error('skip'); },
      getDailyUVIndex: async () => { throw new Error('skip'); },
      getCloudinessTodayAndTomorrow: async () => { throw new Error('skip'); },
      getForecastHalfDays: async () => [],
      getOutlookSlots: async () => [],
    } as unknown as OpenWeatherWeatherProvider;

    const rainNowcast = {
      execute: async () => { throw new Error('skip'); },
    } as unknown as GetRainNowcast;

    if (opts.withRepo === false) {
      return new LegacyDetailsAssembler(getDetails, aemetScraper, aemetPlayas, openWeather, rainNowcast);
    }

    const beachRepo = {
      getAll: async () => opts.catalog,
      getById: async () => null,
    } as unknown as BeachRepository;

    return new LegacyDetailsAssembler(
      getDetails, aemetScraper, aemetPlayas, openWeather, rainNowcast,
      undefined, undefined, 'cantabria', beachRepo,
    );
  }

  it('presta la marea de la playa AEMET más cercana cuando la propia no tiene ficha', async () => {
    const assembler = build({
      beach: NO_TIDES,
      catalog: [NO_TIDES, DONOR, FAR_DONOR],
      donorForecast: donorForecast(),
    });

    const result = await assembler.assemble(NO_TIDES.id);

    expect(result.mareaReferencia).not.toBeNull();
    expect(result.mareaReferencia?.playa).toBe('Somo'); // el más cercano, no Sardinero
    expect(result.mareaReferencia?.municipio).toBe('Ribamontán al Mar');
    expect(result.mareaReferencia?.mareas).toEqual([
      { pleamar: ['09:00', '21:00'], bajamar: ['03:00', '15:00'] },
    ]);
    expect(result.mareaReferencia?.fuenteMareas).toBe('*Fuente: IHM');
    expect(result.mareaReferencia?.distanciaKm).toBeGreaterThan(0);
    expect(result.mareaReferencia?.distanciaKm).toBeLessThan(10);
  });

  it('no presta nada a una playa que ya tiene su propia ficha AEMET', async () => {
    const assembler = build({
      beach: DONOR,
      catalog: [DONOR, FAR_DONOR, NO_TIDES],
      donorForecast: donorForecast(),
    });

    const result = await assembler.assemble(DONOR.id);

    expect(result.mareaReferencia).toBeNull();
    // Sus propias mareas sí llegan, por la vía normal (no la de préstamo).
    expect(result.prediccionCompleta?.mareas).toEqual([
      { pleamar: ['09:00', '21:00'], bajamar: ['03:00', '15:00'] },
    ]);
  });

  it('si el scrape del donante falla y no hay caché, queda sin referencia (el resto del detalle no se rompe)', async () => {
    const assembler = build({
      beach: NO_TIDES,
      catalog: [NO_TIDES, DONOR],
      donorForecast: undefined,
      donorCachedTides: null,
    });

    const result = await assembler.assemble(NO_TIDES.id);

    expect(result.mareaReferencia).toBeNull();
    expect(result.clima).not.toBeNull();
  });

  it('sin repositorio inyectado (compatibilidad hacia atrás) no intenta prestar mareas', async () => {
    const assembler = build({ beach: NO_TIDES, catalog: [], withRepo: false });

    const result = await assembler.assemble(NO_TIDES.id);

    expect(result.mareaReferencia).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tira horaria: el veredicto "mejora" vale mucho más con las horas que lo
// respaldan, y esas horas ya viajan en el nowcast (misma petición, coste 0).
// ---------------------------------------------------------------------------

describe('LegacyDetailsAssembler — previsión horaria en tiempoActual', () => {
  const MEDIODIA = new Date('2026-08-01T11:00:00Z'); // 13:00 Madrid

  const rainCon = (horas: number): RainNowcast => ({
    status: 'dry',
    precipitationMm: 0,
    lastHourOnly: false,
    sources: [],
    timestamp: MEDIODIA.getTime(),
    outlook: Array.from({ length: horas }, (_, i) => ({
      timestamp: MEDIODIA.getTime() + (i + 1) * 3_600_000,
      cloudCoverPct: 20 + i,
      temperatureC: 21,
      windSpeedMs: 3,
    })),
  });

  afterEach(() => vi.useRealTimers());

  it('publica la franja restante completa: la tira es la evidencia de la ventana del día', async () => {
    vi.setSystemTime(MEDIODIA);
    const assembler = buildAssembler({
      details: { beach: COBRECES, weather: makeOwCurrent(), flag: null, tides: null },
      forecast: makeForecast(),
      owCurrent: makeOwCurrent(),
      rain: rainCon(8), // ocho tramos, todos dentro de la franja (14:00–21:00 Madrid)
    });

    const dto = await assembler.assemble('3902401');

    expect(dto.tiempoActual?.previsionHoras).toHaveLength(8);
    expect(dto.tiempoActual?.previsionHoras?.[0]).toEqual({
      horaIso: new Date(MEDIODIA.getTime() + 3_600_000).toISOString(),
      nubesPct: 20,
      temperaturaC: 21,
      vientoMs: 3,
      precipitacionMm: null,
    });
  });

  it('de noche no hay tira: no hay franja de playa que anticipar', async () => {
    const medianoche = new Date('2026-08-01T22:00:00Z'); // 00:00 Madrid
    vi.setSystemTime(medianoche);
    const assembler = buildAssembler({
      details: { beach: COBRECES, weather: makeOwCurrent(), flag: null, tides: null },
      forecast: makeForecast(),
      owCurrent: makeOwCurrent(),
      rain: {
        ...rainCon(4),
        outlook: Array.from({ length: 4 }, (_, i) => ({
          timestamp: medianoche.getTime() + (i + 1) * 3_600_000,
          cloudCoverPct: 0,
          temperatureC: 15,
          windSpeedMs: 2,
        })),
      },
    });

    const dto = await assembler.assemble('3902401');

    expect(dto.tiempoActual?.previsionHoras).toBeNull();
  });

  it('sin Open-Meteo NI suplente el resto del endpoint no se entera', async () => {
    vi.setSystemTime(MEDIODIA);
    const assembler = buildAssembler({
      details: { beach: COBRECES, weather: makeOwCurrent(), flag: null, tides: null },
      forecast: makeForecast(),
      owCurrent: makeOwCurrent(),
      rain: { ...rainCon(0), outlook: null },
      owOutlook: [],
    });

    const dto = await assembler.assemble('3902401');

    expect(dto.tiempoActual?.previsionHoras).toBeNull();
    expect(dto.tiempoActual?.ventanaDia).toBeNull();
    expect(dto.tiempoActual?.lluvia).not.toBeNull();
  });

  it('si Open-Meteo calla, la tira la sirve OpenWeather y se acredita a OpenWeather', async () => {
    // Regresión de producción: Open-Meteo empezó a devolver 429 a la IP de
    // Render y las «próximas 4 h» desaparecieron de las 46 playas a la vez.
    // Una sola fuente gratuita no puede ser un punto único de fallo para un
    // bloque entero de la ficha.
    vi.setSystemTime(MEDIODIA);
    const assembler = buildAssembler({
      details: { beach: COBRECES, weather: makeOwCurrent(), flag: null, tides: null },
      forecast: makeForecast(),
      owCurrent: makeOwCurrent(),
      rain: { ...rainCon(0), outlook: null },
      owOutlook: [
        { timestamp: MEDIODIA.getTime() + 3_600_000, cloudCoverPct: 40, temperatureC: 22, windSpeedMs: 4 },
        { timestamp: MEDIODIA.getTime() + 3 * 3_600_000, cloudCoverPct: 60, temperatureC: 21, windSpeedMs: 5 },
        // Fuera de la ventana: la recorta la misma función de siempre.
        { timestamp: MEDIODIA.getTime() + 9 * 3_600_000, cloudCoverPct: 10, temperatureC: 18, windSpeedMs: 2 },
      ],
    });

    const dto = await assembler.assemble('3902401');

    expect(dto.tiempoActual?.previsionHoras).toHaveLength(2);
    expect(dto.tiempoActual?.previsionHorasFuente).toBe('OpenWeather');
  });

  it('mientras Open-Meteo responda, manda Open-Meteo: el suplente no se toca', async () => {
    vi.setSystemTime(MEDIODIA);
    const assembler = buildAssembler({
      details: { beach: COBRECES, weather: makeOwCurrent(), flag: null, tides: null },
      forecast: makeForecast(),
      owCurrent: makeOwCurrent(),
      rain: rainCon(4),
      owOutlook: () => Promise.reject(new Error('no debería pedirse')),
    });

    const dto = await assembler.assemble('3902401');

    expect(dto.tiempoActual?.previsionHoras).toHaveLength(4);
    expect(dto.tiempoActual?.previsionHorasFuente).toBe('Open-Meteo');
  });
});

// ---------------------------------------------------------------------------
// Ventana del día: CUÁNDO ir, publicada junto a la tira que la respalda.
// ---------------------------------------------------------------------------

describe('LegacyDetailsAssembler — ventana del día en tiempoActual', () => {
  const MEDIODIA = new Date('2026-08-01T11:00:00Z'); // 13:00 Madrid

  const rainCon = (horas: number): RainNowcast => ({
    status: 'dry',
    precipitationMm: 0,
    lastHourOnly: false,
    sources: [],
    timestamp: MEDIODIA.getTime(),
    outlook: Array.from({ length: horas }, (_, i) => ({
      timestamp: MEDIODIA.getTime() + (i + 1) * 3_600_000,
      cloudCoverPct: 20,
      temperatureC: 21,
      windSpeedMs: 3,
    })),
  });

  afterEach(() => vi.useRealTimers());

  it('publica la mejor franja del resto del día, recortada a la franja de playa', async () => {
    vi.setSystemTime(MEDIODIA);
    const assembler = buildAssembler({
      details: { beach: COBRECES, weather: makeOwCurrent(), flag: null, tides: null },
      forecast: makeForecast(),
      owCurrent: makeOwCurrent(),
      rain: rainCon(8), // buenas hasta las 19:00 UTC (21:00 Madrid)
    });

    const dto = await assembler.assemble('3902401');

    expect(dto.tiempoActual?.ventanaDia).toEqual({
      inicio: new Date(MEDIODIA.getTime() + 3_600_000).toISOString(),
      // El último tramo (19:00 UTC) + 1 h se recorta al fin de franja (21:00 Madrid).
      fin: new Date(MEDIODIA.getTime() + 8 * 3_600_000).toISOString(),
      cambio: null,
      // Cubre todo lo evaluado: no venció a ninguna hora, no hay motivo.
      motivo: null,
      horasConsideradas: 8,
    });
    expect(dto.tiempoActual?.ventanaDiaFuente).toBe('Open-Meteo');
  });

  it('si Open-Meteo calla, la ventana la sirve OpenWeather con su paso de 3 h', async () => {
    vi.setSystemTime(MEDIODIA);
    const assembler = buildAssembler({
      details: { beach: COBRECES, weather: makeOwCurrent(), flag: null, tides: null },
      forecast: makeForecast(),
      owCurrent: makeOwCurrent(),
      rain: { ...rainCon(0), outlook: null },
      owOutlook: [1, 4, 7].map((h) => ({
        timestamp: MEDIODIA.getTime() + h * 3_600_000,
        cloudCoverPct: 5,
        temperatureC: 24,
        windSpeedMs: 2,
      })),
    });

    const dto = await assembler.assemble('3902401');

    expect(dto.tiempoActual?.ventanaDia?.inicio).toBe(
      new Date(MEDIODIA.getTime() + 3_600_000).toISOString(),
    );
    expect(dto.tiempoActual?.ventanaDiaFuente).toBe('OpenWeather');
  });

  it('si Open-Meteo respondió y el veredicto es "no hay franja buena", el suplente no opina', async () => {
    vi.setSystemTime(MEDIODIA);
    const assembler = buildAssembler({
      details: { beach: COBRECES, weather: makeOwCurrent(), flag: null, tides: null },
      forecast: makeForecast(),
      owCurrent: makeOwCurrent(),
      // Día gris de verdad: ninguna hora llega al suelo absoluto.
      rain: {
        ...rainCon(0),
        outlook: Array.from({ length: 6 }, (_, i) => ({
          timestamp: MEDIODIA.getTime() + (i + 1) * 3_600_000,
          cloudCoverPct: 95,
          temperatureC: 14,
          windSpeedMs: 10,
        })),
      },
      owOutlook: () => Promise.reject(new Error('no debería pedirse')),
    });

    const dto = await assembler.assemble('3902401');

    expect(dto.tiempoActual?.ventanaDia).toBeNull();
  });
});

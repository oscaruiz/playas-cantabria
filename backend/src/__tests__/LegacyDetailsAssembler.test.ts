import { describe, it, expect } from 'vitest';
import { LegacyDetailsAssembler } from '../application/services/LegacyDetailsAssembler';
import type { GetBeachDetails, BeachDetails } from '../domain/use-cases/GetBeachDetails';
import type { AemetBeachWebScraper } from '../infrastructure/providers/AemetBeachWebScraper';
import type { AemetBeachForecastProvider } from '../infrastructure/providers/AemetBeachForecastProvider';
import type { OpenWeatherWeatherProvider } from '../infrastructure/providers/OpenWeatherWeatherProvider';
import type { Beach } from '../domain/entities/Beach';
import type { Weather } from '../domain/entities/Weather';
import type { BeachFullForecast } from '../domain/entities/BeachForecast';

// ---------------------------------------------------------------------------
// Fixtures — payload tipo Cóbreces: la MAÑANA y la TARDE de HOY discrepan.
// Es justo el caso del bug: el héroe "Hoy" antes titulaba con la TARDE
// ("Despejado") mientras el bloque MAÑANA mostraba "Muy nuboso".
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
    // Las enriquecimientos posteriores no son relevantes para este test: fallan suave.
    getTomorrowByCoords: async () => {
      throw new Error('skip');
    },
    getDailyUVIndex: async () => {
      throw new Error('skip');
    },
    getCloudinessTodayAndTomorrow: async () => {
      throw new Error('skip');
    },
  } as unknown as OpenWeatherWeatherProvider;

  return new LegacyDetailsAssembler(getDetails, aemetScraper, aemetPlayas, openWeather);
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
    // El héroe antiguo titulaba con `tarde.cielo` → "Despejado", contradiciendo
    // al bloque MAÑANA ("Muy nuboso"). Ambos salen del MISMO objeto/petición.
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
    expect(result.tiempoActual?.icono).toBe(200); // '10d' → lluvia

    // La previsión AEMET (desglose) permanece intacta como tramos futuros.
    expect(result.prediccionCompleta?.dias[0].tarde.cielo).toBe('Despejado');
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
});

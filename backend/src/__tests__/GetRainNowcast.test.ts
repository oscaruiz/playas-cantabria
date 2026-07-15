import { describe, it, expect } from 'vitest';
import {
  GetRainNowcast,
  isOpenWeatherPrecipitating,
  isOpenMeteoPrecipitating,
  isAemetPrecipitating,
  computeUpcoming,
} from '../domain/use-cases/GetRainNowcast';
import { InMemoryCache } from '../infrastructure/cache/InMemoryCache';
import type { Weather } from '../domain/entities/Weather';
import type { PrecipitationNow, PrecipitationSlot } from '../domain/entities/RainNowcast';
import type { WeatherProvider } from '../domain/ports/WeatherProvider';
import type { PrecipitationNowProvider } from '../domain/ports/PrecipitationNowProvider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWeather(overrides: Partial<Weather> = {}): Weather {
  return {
    source: 'OpenWeather',
    timestamp: 1750000000000,
    temperatureC: 24,
    description: 'muy nuboso',
    icon: '04d',
    precipitationMm: null,
    conditionCode: 803,
    windSpeedMs: 3,
    windDirectionDeg: 320,
    humidityPct: 79,
    pressureHPa: 1019,
    ...overrides,
  };
}

function makeOmNow(overrides: Partial<PrecipitationNow> = {}): PrecipitationNow {
  return {
    source: 'OpenMeteo',
    timestamp: 1750000000000,
    precipitationMm: 0,
    rainMm: 0,
    showersMm: 0,
    weatherCode: 3,
    ...overrides,
  };
}

const FAIL = Symbol('fail');
type Result<T> = T | typeof FAIL;

function fakeWeatherProvider(result: Result<Weather>) {
  const p = {
    calls: 0,
    async getCurrentByCoords(): Promise<Weather> {
      p.calls++;
      if (result === FAIL) throw new Error('provider down');
      return result;
    },
  };
  return p as WeatherProvider & { calls: number };
}

function fakeOmProvider(result: Result<PrecipitationNow>) {
  const p = {
    calls: 0,
    async getPrecipitationNow(): Promise<PrecipitationNow> {
      p.calls++;
      if (result === FAIL) throw new Error('provider down');
      return result;
    },
  };
  return p as PrecipitationNowProvider & { calls: number };
}

function build(opts: {
  ow?: Result<Weather>;
  aemet?: Result<Weather>;
  om?: Result<PrecipitationNow>;
}) {
  const ow = fakeWeatherProvider(opts.ow ?? FAIL);
  const aemet = fakeWeatherProvider(opts.aemet ?? FAIL);
  const om = fakeOmProvider(opts.om ?? FAIL);
  const useCase = new GetRainNowcast(ow, aemet, om, new InMemoryCache());
  return { useCase, ow, aemet, om };
}

const DRY_OW = makeWeather({ conditionCode: 803, precipitationMm: null });
const DRY_AEMET = makeWeather({ source: 'AEMET', conditionCode: null, precipitationMm: 0 });
const DRY_OM = makeOmNow();

// ---------------------------------------------------------------------------
// Helpers puros de detección
// ---------------------------------------------------------------------------

describe('isOpenWeatherPrecipitating', () => {
  it('detecta lluvia por código de condición (2xx tormenta, 3xx llovizna, 5xx lluvia, 6xx nieve)', () => {
    for (const code of [210, 301, 500, 531, 615]) {
      expect(isOpenWeatherPrecipitating(makeWeather({ conditionCode: code }))).toBe(true);
    }
  });

  it('no detecta lluvia con cielo nuboso (código 803, caso Cóbreces)', () => {
    expect(isOpenWeatherPrecipitating(makeWeather({ conditionCode: 803 }))).toBe(false);
    expect(isOpenWeatherPrecipitating(makeWeather({ conditionCode: 800 }))).toBe(false);
    expect(isOpenWeatherPrecipitating(makeWeather({ conditionCode: 741 }))).toBe(false);
  });

  it('detecta lluvia por mm aunque falte el código', () => {
    expect(isOpenWeatherPrecipitating(makeWeather({ conditionCode: null, precipitationMm: 0.3 }))).toBe(true);
    expect(isOpenWeatherPrecipitating(makeWeather({ conditionCode: null, precipitationMm: 0 }))).toBe(false);
  });
});

describe('isOpenMeteoPrecipitating', () => {
  it('detecta por código WMO de precipitación (llovizna 51, lluvia 61, chubascos 80, tormenta 95)', () => {
    for (const code of [51, 61, 67, 80, 82, 95, 99]) {
      expect(isOpenMeteoPrecipitating(makeOmNow({ weatherCode: code }))).toBe(true);
    }
  });

  it('no detecta con cielo cubierto (WMO 3) o niebla (45) sin mm', () => {
    expect(isOpenMeteoPrecipitating(makeOmNow({ weatherCode: 3 }))).toBe(false);
    expect(isOpenMeteoPrecipitating(makeOmNow({ weatherCode: 45 }))).toBe(false);
  });

  it('detecta por mm de lluvia/chubascos aunque el código sea benigno', () => {
    expect(isOpenMeteoPrecipitating(makeOmNow({ precipitationMm: 0.2 }))).toBe(true);
    expect(isOpenMeteoPrecipitating(makeOmNow({ rainMm: 0.1 }))).toBe(true);
    expect(isOpenMeteoPrecipitating(makeOmNow({ showersMm: 0.4 }))).toBe(true);
  });
});

describe('isAemetPrecipitating', () => {
  it('detecta por acumulado del pluviómetro y tolera null', () => {
    expect(isAemetPrecipitating(makeWeather({ precipitationMm: 0.2 }))).toBe(true);
    expect(isAemetPrecipitating(makeWeather({ precipitationMm: 0 }))).toBe(false);
    expect(isAemetPrecipitating(makeWeather({ precipitationMm: null }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeUpcoming (previsión próximas 6h, tramos minutely_15)
// ---------------------------------------------------------------------------

const slot = (offsetMin: number, mm: number | null, code: number | null): PrecipitationSlot => ({
  timestamp: 1750000000000 + offsetMin * 60000,
  precipitationMm: mm,
  weatherCode: code,
});

describe('computeUpcoming', () => {
  it('sin tramos (payload antiguo o vacío) → null', () => {
    expect(computeUpcoming(makeOmNow())).toBeNull();
    expect(computeUpcoming(makeOmNow({ upcomingSlots: [] }))).toBeNull();
  });

  it('todos los tramos secos → expected false', () => {
    const p = makeOmNow({ upcomingSlots: [slot(0, 0, 3), slot(15, 0, 2), slot(30, null, 1)] });
    expect(computeUpcoming(p)).toEqual({ expected: false, firstAt: null, mmMax: null });
  });

  it('primer tramo con lluvia marca firstAt; mmMax es el máximo de los tramos con precip', () => {
    const p = makeOmNow({
      upcomingSlots: [slot(0, 0, 3), slot(15, 0, 3), slot(30, 0.2, 61), slot(45, 0.6, 63), slot(60, 0.1, 61)],
    });
    const u = computeUpcoming(p);
    expect(u?.expected).toBe(true);
    expect(u?.firstAt).toBe(1750000000000 + 30 * 60000);
    expect(u?.mmMax).toBe(0.6);
  });

  it('dispara por mm aunque el código sea benigno, y por código WMO aunque falten los mm', () => {
    expect(computeUpcoming(makeOmNow({ upcomingSlots: [slot(0, 0.3, 3)] }))?.expected).toBe(true);
    const soloCodigo = computeUpcoming(makeOmNow({ upcomingSlots: [slot(0, null, 80)] }));
    expect(soloCodigo?.expected).toBe(true);
    expect(soloCodigo?.mmMax).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Agregación
// ---------------------------------------------------------------------------

describe('GetRainNowcast — agregación multi-fuente', () => {
  it('caso Cóbreces: OpenWeather dice "muy nuboso" pero Open-Meteo ve llovizna → raining', async () => {
    const { useCase } = build({
      ow: DRY_OW,
      aemet: DRY_AEMET,
      om: makeOmNow({ weatherCode: 51, precipitationMm: 0.1 }),
    });

    const r = await useCase.execute(43.3944, -4.2205);

    expect(r.status).toBe('raining');
    expect(r.lastHourOnly).toBe(false);
    expect(r.sources).toHaveLength(3);
  });

  it('solo el pluviómetro AEMET dispara → raining con lastHourOnly (llovió en la última hora)', async () => {
    const { useCase } = build({
      ow: DRY_OW,
      aemet: makeWeather({ source: 'AEMET', precipitationMm: 0.6 }),
      om: DRY_OM,
    });

    const r = await useCase.execute(43.3944, -4.2205);

    expect(r.status).toBe('raining');
    expect(r.lastHourOnly).toBe(true);
  });

  it('todas las fuentes secas → dry', async () => {
    const { useCase } = build({ ow: DRY_OW, aemet: DRY_AEMET, om: DRY_OM });

    const r = await useCase.execute(43.3944, -4.2205);

    expect(r.status).toBe('dry');
    expect(r.lastHourOnly).toBe(false);
  });

  it('todas las fuentes caídas → unknown, sin fuentes', async () => {
    const { useCase } = build({ ow: FAIL, aemet: FAIL, om: FAIL });

    const r = await useCase.execute(43.3944, -4.2205);

    expect(r.status).toBe('unknown');
    expect(r.sources).toHaveLength(0);
    expect(r.precipitationMm).toBeNull();
  });

  it('una fuente caída no rompe: las otras deciden y la caída no aparece en sources', async () => {
    const { useCase } = build({ ow: FAIL, aemet: FAIL, om: DRY_OM });

    const r = await useCase.execute(43.3944, -4.2205);

    expect(r.status).toBe('dry');
    expect(r.sources.map((s) => s.source)).toEqual(['OpenMeteo']);
  });

  it('precipitationMm agregado = máximo de los reportados', async () => {
    const { useCase } = build({
      ow: makeWeather({ conditionCode: 500, precipitationMm: 0.5 }),
      aemet: makeWeather({ source: 'AEMET', precipitationMm: 1.2 }),
      om: makeOmNow({ weatherCode: 61, precipitationMm: 0.3 }),
    });

    const r = await useCase.execute(43.3944, -4.2205);

    expect(r.status).toBe('raining');
    expect(r.precipitationMm).toBe(1.2);
  });

  it('propaga la previsión de Open-Meteo (upcoming) aunque el estado actual sea seco', async () => {
    const { useCase } = build({
      ow: DRY_OW,
      aemet: DRY_AEMET,
      om: makeOmNow({ upcomingSlots: [slot(0, 0, 3), slot(15, 0.4, 61)] }),
    });

    const r = await useCase.execute(43.3944, -4.2205);

    expect(r.status).toBe('dry');
    expect(r.upcoming?.expected).toBe(true);
    expect(r.upcoming?.firstAt).toBe(1750000000000 + 15 * 60000);
  });

  it('si Open-Meteo cae, upcoming es null (sin previsión numérica)', async () => {
    const { useCase } = build({ ow: DRY_OW, aemet: DRY_AEMET, om: FAIL });

    const r = await useCase.execute(43.3944, -4.2205);

    expect(r.upcoming).toBeNull();
  });

  it('cachea por coordenadas: la segunda llamada no re-invoca los providers', async () => {
    const { useCase, ow, aemet, om } = build({ ow: DRY_OW, aemet: DRY_AEMET, om: DRY_OM });

    await useCase.execute(43.3944, -4.2205);
    await useCase.execute(43.3944, -4.2205);

    expect(ow.calls).toBe(1);
    expect(aemet.calls).toBe(1);
    expect(om.calls).toBe(1);
  });
});

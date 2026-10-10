import { describe, it, expect, vi } from 'vitest';
import { BeachConditions, type SkyCorrector } from '../domain/use-cases/BeachConditions';
import type { Beach } from '../domain/entities/Beach';
import type { Weather } from '../domain/entities/Weather';
import type { FlagStatus } from '../domain/entities/Flag';
import type { RainNowcast } from '../domain/entities/RainNowcast';
import type { WeatherProvider } from '../domain/ports/WeatherProvider';
import type { FlagProvider } from '../domain/ports/FlagProvider';
import type { SunshineProvider } from '../domain/ports/SunshineProvider';
import type { SunshineObservation } from '../domain/entities/Sunshine';
import type { PrecipitationNow } from '../domain/entities/RainNowcast';
import type { PrecipitationNowProvider } from '../domain/ports/PrecipitationNowProvider';
import type { BeachForecastProvider } from '../domain/ports/BeachForecastProvider';
import type { BeachShortForecast } from '../domain/entities/BeachForecast';

const BEACH: Beach = {
  id: '1', name: 'Playa Test', municipality: 'Test', aemetCode: '0000001',
  latitude: 43.4, longitude: -4,
  flagStations: [
    { ref: { provider: 'cruzroja', ref: 1 }, sourceName: 'PUESTO 1' },
    { ref: { provider: 'cruzroja', ref: 2 }, sourceName: 'PUESTO 2' },
  ],
};

const weather = (source: Weather['source']): Weather => ({
  source, timestamp: 1, temperatureC: 20, description: 'cielo claro', icon: '01d',
  windSpeedMs: 2, windDirectionDeg: 0, humidityPct: 50, pressureHPa: 1013,
});

const up = (w: Weather): WeatherProvider => ({ getCurrentByCoords: async () => w });
const down: WeatherProvider = { getCurrentByCoords: async () => { throw new Error('down'); } };

const RAIN: RainNowcast = {
  status: 'raining', precipitationMm: 1, lastHourOnly: false, sources: [], timestamp: 1,
  outlook: [{ timestamp: 2, cloudCoverPct: 90, temperatureC: 18, windSpeedMs: 3 }],
};

function build(opts: {
  ow?: WeatherProvider;
  aemet?: WeatherProvider;
  flags?: Record<number, FlagStatus>;
  rain?: RainNowcast | Error;
  sunshine?: SunshineProvider;
  skyEnabled?: boolean;
  correctSky?: SkyCorrector;
  openMeteo?: PrecipitationNowProvider;
  aemetForecast?: BeachForecastProvider;
}) {
  const flags: FlagProvider = { getFlag: async (ref) => opts.flags?.[ref.ref] ?? null };
  const rain = {
    execute: async () => {
      if (opts.rain instanceof Error) throw opts.rain;
      return opts.rain ?? null;
    },
  };
  return new BeachConditions(
    opts.aemet ?? down,
    opts.ow ?? down,
    flags,
    rain as never,
    opts.sunshine,
    () => opts.skyEnabled ?? true,
    opts.correctSky ?? ((_n, w) => w),
    opts.openMeteo,
    opts.aemetForecast,
  );
}

describe('BeachConditions', () => {
  it('weather: OpenWeather first, AEMET only if it fails, null if both do', async () => {
    expect((await build({ ow: up(weather('OpenWeather')), aemet: up(weather('AEMET')) }).now(BEACH)).weather?.source)
      .toBe('OpenWeather');
    expect((await build({ aemet: up(weather('AEMET')) }).now(BEACH)).weather?.source).toBe('AEMET');
    expect((await build({}).now(BEACH)).weather).toBeNull();
  });

  it('flag: aggregates every station into the most restrictive RAW reading', async () => {
    const { flag } = await build({
      flags: { 1: { color: 'green', timestamp: 1 }, 2: { color: 'red', timestamp: 1 } },
    }).now(BEACH);
    // timestamp 1 is decades stale: the module does not judge currency.
    expect(flag?.color).toBe('red');
  });

  it('the sky corrector gets the rain status and outlook from the nowcast', async () => {
    const correctSky = vi.fn<SkyCorrector>((_n, w) => w && { ...w, description: 'corregido' });
    const sun = [{ insoMin: 0, fraccion: 0, distanciaKm: 1, idema: '1111X' }] as unknown as SunshineObservation[];
    const sunshine = { getSunshineNear: async () => sun } as unknown as SunshineProvider;

    const result = await build({ ow: up(weather('OpenWeather')), rain: RAIN, sunshine, correctSky }).now(BEACH);

    expect(result.weather?.description).toBe('corregido');
    expect(result.rain).toBe(RAIN);
    const [name, , gotSun, raining, , outlook] = correctSky.mock.calls[0];
    expect(name).toBe('Playa Test');
    expect(gotSun).toBe(sun);
    expect(raining).toBe(true);
    expect(outlook).toBe(RAIN.outlook);
  });

  it('rain nowcast down → rain null, the rest intact', async () => {
    const result = await build({ ow: up(weather('OpenWeather')), rain: new Error('down') }).now(BEACH);
    expect(result.rain).toBeNull();
    expect(result.weather).not.toBeNull();
  });

  it('sunshine is not asked for when the correction is off or there is no provider', async () => {
    const getSunshineNear = vi.fn(async () => []);
    const sunshine = { getSunshineNear } as unknown as SunshineProvider;
    const correctSky = vi.fn<SkyCorrector>((_n, w) => w);

    await build({ sunshine, skyEnabled: false, correctSky }).now(BEACH);
    await build({ skyEnabled: true, correctSky }).now(BEACH);

    expect(getSunshineNear).not.toHaveBeenCalled();
    expect(correctSky.mock.calls.map((c) => c[2])).toEqual([[], []]);
  });

  it('probeSunshine throws when the provider is down, and is a no-op when off', async () => {
    const sunshine = { getSunshineNear: async () => { throw new Error('AEMET unavailable'); } } as unknown as SunshineProvider;
    await expect(build({ sunshine }).probeSunshine(BEACH)).rejects.toThrow('AEMET unavailable');
    await expect(build({ sunshine, skyEnabled: false }).probeSunshine(BEACH)).resolves.toBeUndefined();
  });

  describe('sky chain: OpenWeather → Open-Meteo → AEMET forecast (previsto) → none (10-oct-2026)', () => {
    const openMeteoNow = (weatherCode: number | null): PrecipitationNow => ({
      source: 'OpenMeteo', timestamp: 5, precipitationMm: 0, rainMm: 0, showersMm: 0, weatherCode,
      current: { temperatureC: 21, cloudCoverPct: 40, windSpeedMs: 3, windDirectionDeg: 90, humidityPct: 60, isDay: true },
    });
    const meteo = (now: PrecipitationNow): PrecipitationNowProvider => ({ getPrecipitationNow: async () => now });
    const meteoDown: PrecipitationNowProvider = { getPrecipitationNow: async () => { throw new Error('429'); } };
    const forecast = (summary: string): BeachForecastProvider => ({
      getByBeachCode: async () => ({ today: { summary } } as unknown as BeachShortForecast),
    });
    const station = weather('AEMET');

    it('OpenWeather wins while it answers', async () => {
      const { weather: w } = await build({
        ow: up(weather('OpenWeather')), openMeteo: meteo(openMeteoNow(2)), aemet: up(station),
      }).now(BEACH);
      expect(w?.source).toBe('OpenWeather');
    });

    it("without OpenWeather, Open-Meteo's reading in OpenWeather's words and icons", async () => {
      const { weather: w } = await build({ openMeteo: meteo(openMeteoNow(2)), aemet: up(station) }).now(BEACH);
      expect(w).toMatchObject({
        source: 'Open-Meteo', description: 'nubes dispersas', icon: '03d', temperatureC: 21, cloudinessPct: 40,
      });
      expect(w?.previsto).toBeUndefined();
    });

    it("without either, the station's temperature with today's FORECAST sky, labelled", async () => {
      const { weather: w } = await build({
        openMeteo: meteoDown, aemet: up(station), aemetForecast: forecast('Muy nuboso'),
      }).now(BEACH);
      expect(w).toMatchObject({ source: 'AEMET', description: 'Muy nuboso', icon: '04d', previsto: true, temperatureC: 20 });
    });

    it('with no forecast either, no sky at all: never one made up from the station', async () => {
      const { weather: w } = await build({ openMeteo: meteo(openMeteoNow(null)), aemet: up(station) }).now(BEACH);
      expect(w).toMatchObject({ source: 'AEMET', description: null, icon: null, temperatureC: 20 });
      expect(w?.previsto).toBeUndefined();
    });
  });
});

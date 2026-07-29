import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { OpenWeatherWeatherProvider } from '../infrastructure/providers/OpenWeatherWeatherProvider';
import { InMemoryCache } from '../infrastructure/cache/InMemoryCache';
import { http } from '../infrastructure/http/axiosClient';

/**
 * La cuota gratuita de OpenWeather (60 llamadas/min) es el techo real de la app.
 * Estos tests fijan el contrato de AHORRO: una playa no puede costar más de dos
 * peticiones por TTL (observación actual + forecast), pase lo que pase.
 */

const HORA = 3600;

function forecastSlot(iso: string, opts: { clouds?: number; temp?: number } = {}) {
  return {
    dt: Date.parse(iso) / 1000,
    main: { temp: opts.temp ?? 20, humidity: 60, pressure: 1015 },
    weather: [{ id: 800, description: 'cielo claro', icon: '01d' }],
    wind: { speed: 3, deg: 90 },
    clouds: { all: opts.clouds ?? 25 },
  };
}

/** 5 días de slots cada 3 h a partir de ahora, como devuelve /data/2.5/forecast. */
function forecastPayload() {
  const base = Date.now();
  const list = Array.from({ length: 40 }, (_, i) =>
    forecastSlot(new Date(base + i * 3 * HORA * 1000).toISOString(), { clouds: 40 }),
  );
  return { data: { list, city: { timezone: 0 } } };
}

const CURRENT_PAYLOAD = {
  data: {
    dt: Math.floor(Date.now() / 1000),
    main: { temp: 22, humidity: 70, pressure: 1012 },
    weather: [{ id: 801, description: 'algo de nubes', icon: '02d' }],
    wind: { speed: 4, deg: 300 },
    clouds: { all: 33 },
  },
};

const esForecast = (url: string) => url.includes('/forecast');

beforeEach(() => {
  process.env.OPENWEATHER_API_KEY = 'test-key';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OpenWeatherWeatherProvider — consumo de cuota', () => {
  it('tomorrow + medios días + nubosidad comparten UNA sola llamada a /forecast', async () => {
    const spy = vi.spyOn(http, 'get').mockImplementation(async (url: string) =>
      (esForecast(url) ? forecastPayload() : CURRENT_PAYLOAD) as any,
    );
    const provider = new OpenWeatherWeatherProvider(new InMemoryCache());

    await provider.getTomorrowByCoords(43.4, -4.2);
    await provider.getForecastHalfDays(43.4, -4.2, 3);
    await provider.getCloudinessTodayAndTomorrow(43.4, -4.2);

    const forecastCalls = spy.mock.calls.filter(([url]) => esForecast(url as string));
    expect(forecastCalls).toHaveLength(1);
  });

  it('una playa cuesta 2 peticiones: /weather + /forecast', async () => {
    const spy = vi.spyOn(http, 'get').mockImplementation(async (url: string) =>
      (esForecast(url) ? forecastPayload() : CURRENT_PAYLOAD) as any,
    );
    const provider = new OpenWeatherWeatherProvider(new InMemoryCache());

    await provider.getCurrentByCoords(43.4, -4.2);
    await provider.getTomorrowByCoords(43.4, -4.2);
    await provider.getForecastHalfDays(43.4, -4.2, 3);
    await provider.getCloudinessTodayAndTomorrow(43.4, -4.2);

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('la nubosidad de hoy sale de la observación ya cacheada, no de una llamada nueva', async () => {
    vi.spyOn(http, 'get').mockImplementation(async (url: string) =>
      (esForecast(url) ? forecastPayload() : CURRENT_PAYLOAD) as any,
    );
    const provider = new OpenWeatherWeatherProvider(new InMemoryCache());

    const clouds = await provider.getCloudinessTodayAndTomorrow(43.4, -4.2);

    expect(clouds.today).toBe(33); // clouds.all de /weather
    expect(clouds.tomorrow).toBe(40); // clouds.all del slot elegido de /forecast
  });

  it('no propaga el fallo de /forecast si la observación actual respondió', async () => {
    vi.spyOn(http, 'get').mockImplementation(async (url: string) => {
      if (esForecast(url)) throw new Error('502 Bad Gateway');
      return CURRENT_PAYLOAD as any;
    });
    const provider = new OpenWeatherWeatherProvider(new InMemoryCache());

    await expect(provider.getCloudinessTodayAndTomorrow(43.4, -4.2)).resolves.toEqual({
      today: 33,
      tomorrow: null,
    });
  });
});

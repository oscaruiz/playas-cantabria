import { describe, it, expect, vi, afterEach } from 'vitest';
import { OpenMeteoPrecipitationProvider } from '../infrastructure/providers/OpenMeteoPrecipitationProvider';
import { InMemoryCache } from '../infrastructure/cache/InMemoryCache';
import { http } from '../infrastructure/http/axiosClient';

const HAPPY_PAYLOAD = {
  data: {
    current: {
      time: '2026-07-15T19:00',
      precipitation: 0.2,
      rain: 0.2,
      showers: 0,
      weather_code: 61,
    },
    minutely_15: {
      time: ['2026-07-15T19:00', '2026-07-15T19:15', '2026-07-15T19:30'],
      precipitation: [0.2, 0, 0.5],
      weather_code: [61, 3, 63],
    },
  },
};

afterEach(() => vi.restoreAllMocks());

describe('OpenMeteoPrecipitationProvider', () => {
  it('parsea el bloque current (mm + código WMO) y el timestamp UTC', async () => {
    vi.spyOn(http, 'get').mockResolvedValue(HAPPY_PAYLOAD as any);
    const provider = new OpenMeteoPrecipitationProvider(new InMemoryCache());

    const now = await provider.getPrecipitationNow(43.3944, -4.2205);

    expect(now.source).toBe('OpenMeteo');
    expect(now.precipitationMm).toBe(0.2);
    expect(now.rainMm).toBe(0.2);
    expect(now.showersMm).toBe(0);
    expect(now.weatherCode).toBe(61);
    expect(now.timestamp).toBe(Date.parse('2026-07-15T19:00:00Z'));
  });

  it('pide precipitación actual sin API key (endpoint gratuito)', async () => {
    const spy = vi.spyOn(http, 'get').mockResolvedValue(HAPPY_PAYLOAD as any);
    const provider = new OpenMeteoPrecipitationProvider(new InMemoryCache());

    await provider.getPrecipitationNow(43.3944, -4.2205);

    const [url, config] = spy.mock.calls[0] as any[];
    expect(url).toContain('api.open-meteo.com');
    expect(config.params.current).toContain('precipitation');
    expect(config.params.current).toContain('weather_code');
    expect(config.params.appid).toBeUndefined();
  });

  it('pide la previsión de 6h (24 tramos de 15 min) en la misma llamada', async () => {
    const spy = vi.spyOn(http, 'get').mockResolvedValue(HAPPY_PAYLOAD as any);
    const provider = new OpenMeteoPrecipitationProvider(new InMemoryCache());

    await provider.getPrecipitationNow(43.3944, -4.2205);

    const config = (spy.mock.calls[0] as any[])[1];
    expect(config.params.minutely_15).toBe('precipitation,weather_code');
    expect(config.params.forecast_minutely_15).toBe(24);
  });

  it('parsea los tramos minutely_15 con timestamps UTC', async () => {
    vi.spyOn(http, 'get').mockResolvedValue(HAPPY_PAYLOAD as any);
    const provider = new OpenMeteoPrecipitationProvider(new InMemoryCache());

    const now = await provider.getPrecipitationNow(43.3944, -4.2205);

    expect(now.upcomingSlots).toHaveLength(3);
    expect(now.upcomingSlots?.[0]).toEqual({
      timestamp: Date.parse('2026-07-15T19:00:00Z'),
      precipitationMm: 0.2,
      weatherCode: 61,
    });
    expect(now.upcomingSlots?.[2].precipitationMm).toBe(0.5);
  });

  it('payload sin bloque minutely_15 → upcomingSlots vacío (defensivo)', async () => {
    vi.spyOn(http, 'get').mockResolvedValue({ data: { current: { time: '2026-07-15T19:00' } } } as any);
    const provider = new OpenMeteoPrecipitationProvider(new InMemoryCache());

    const now = await provider.getPrecipitationNow(43.3944, -4.2205);

    expect(now.upcomingSlots).toEqual([]);
  });

  it('parseo defensivo: payload sin current → todos los campos null', async () => {
    vi.spyOn(http, 'get').mockResolvedValue({ data: {} } as any);
    const provider = new OpenMeteoPrecipitationProvider(new InMemoryCache());

    const now = await provider.getPrecipitationNow(43.3944, -4.2205);

    expect(now.precipitationMm).toBeNull();
    expect(now.rainMm).toBeNull();
    expect(now.showersMm).toBeNull();
    expect(now.weatherCode).toBeNull();
  });

  it('error de red → ProviderError con provider OpenMeteo', async () => {
    vi.spyOn(http, 'get').mockRejectedValue(new Error('network down'));
    const provider = new OpenMeteoPrecipitationProvider(new InMemoryCache());

    await expect(provider.getPrecipitationNow(43.3944, -4.2205)).rejects.toMatchObject({
      name: 'ProviderError',
      provider: 'OpenMeteo',
    });
  });

  it('cachea por coordenadas: segunda llamada sin petición HTTP', async () => {
    const spy = vi.spyOn(http, 'get').mockResolvedValue(HAPPY_PAYLOAD as any);
    const provider = new OpenMeteoPrecipitationProvider(new InMemoryCache());

    await provider.getPrecipitationNow(43.3944, -4.2205);
    await provider.getPrecipitationNow(43.3944, -4.2205);

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

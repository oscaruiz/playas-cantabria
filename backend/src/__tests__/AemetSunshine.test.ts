import { describe, it, expect, vi, afterEach } from 'vitest';
import { AemetWeatherProvider } from '../infrastructure/providers/AemetWeatherProvider';
import { InMemoryCache } from '../infrastructure/cache/InMemoryCache';
import { http } from '../infrastructure/http/axiosClient';

afterEach(() => vi.restoreAllMocks());

const FINT = '2026-07-29T10:00:00+0000';

/**
 * Estaciones reales del arco cantábrico. Lo importante: Castro-EDAR y Treto
 * EXISTEN y están en la costa oriental, pero no publican `inso`. Es el motivo por
 * el que no vale reutilizar la estación que elige `getCurrentByCoords`.
 */
const OBSERVACIONES = [
  { idema: '1111X', ubi: 'SANTANDER CMT', lat: 43.491, lon: -3.8, fint: FINT, ta: 22.6, inso: 31.9 },
  { idema: '1109X', ubi: 'SANTANDER AEROPUERTO', lat: 43.429, lon: -3.831, fint: FINT, ta: 24.5, inso: 14 },
  { idema: '1159', ubi: 'SAN VICENTE-FARO', lat: 43.42, lon: -4.748, fint: FINT, ta: 22.6 },
  { idema: '1096', ubi: 'CASTRO URDIALES-EDAR', lat: 43.395, lon: -3.234, fint: FINT, ta: 23.1 },
  { idema: '1082', ubi: 'TRETO', lat: 43.397, lon: -3.47, fint: FINT, ta: 23.4 },
];

function mockAemet(filas: unknown[]) {
  return vi
    .spyOn(http, 'get')
    .mockResolvedValueOnce({ data: { datos: 'https://opendata.aemet.es/datos/x' } } as any)
    .mockResolvedValueOnce({ data: filas } as any);
}

function provider() {
  return new AemetWeatherProvider(new InMemoryCache());
}

describe('AemetWeatherProvider.getSunshineNear', () => {
  it('ignora las estaciones sin insolación aunque sean las más cercanas', async () => {
    mockAemet(OBSERVACIONES);
    // Playa de Castro Urdiales: la estación pegada (Castro-EDAR) no mide sol.
    const res = await provider().getSunshineNear(43.38, -3.22);

    expect(res.map((o) => o.idema)).not.toContain('1096');
    expect(res.map((o) => o.idema)).not.toContain('1082');
    // La más cercana CON insolación está en Santander, a casi 50 km: por eso las
    // playas de Castro son las peor cubiertas y necesitan un segundo testigo.
    expect(res[0].idema).toBe('1111X');
    expect(res[0].distanciaKm).toBeGreaterThan(40);
  });

  it('devuelve ordenadas por distancia y como mucho tres', async () => {
    mockAemet(OBSERVACIONES);
    const res = await provider().getSunshineNear(43.47, -3.79); // Sardinero

    expect(res.length).toBeLessThanOrEqual(3);
    expect(res[0].idema).toBe('1111X');
    const distancias = res.map((o) => o.distanciaKm);
    expect([...distancias].sort((a, b) => a - b)).toEqual(distancias);
  });

  it('calcula la fracción de sol sobre 60 minutos', async () => {
    mockAemet(OBSERVACIONES);
    const res = await provider().getSunshineNear(43.47, -3.79);

    expect(res[0].insoMin).toBe(31.9);
    expect(res[0].fraccion).toBeCloseTo(31.9 / 60, 5);
    expect(res[0].observadoEn).toBe(Date.parse(FINT));
  });

  it('descarta valores fuera de [0, 60] por si AEMET cambiara la unidad', async () => {
    mockAemet([
      { idema: 'RARA', ubi: 'X', lat: 43.47, lon: -3.79, fint: FINT, inso: 999 },
      { idema: 'OTRA', ubi: 'Y', lat: 43.46, lon: -3.78, fint: FINT, inso: -3 },
      ...OBSERVACIONES,
    ]);
    const res = await provider().getSunshineNear(43.47, -3.79);

    expect(res.map((o) => o.idema)).not.toContain('RARA');
    expect(res.map((o) => o.idema)).not.toContain('OTRA');
  });

  it('se queda con la fila más reciente de cada estación', async () => {
    // El payload trae varias horas por estación; una fila recién publicada puede
    // venir incompleta, así que solo cuentan las que traen `inso`.
    mockAemet([
      { idema: '1111X', ubi: 'SANTANDER CMT', lat: 43.491, lon: -3.8, fint: '2026-07-29T08:00:00+0000', inso: 0 },
      { idema: '1111X', ubi: 'SANTANDER CMT', lat: 43.491, lon: -3.8, fint: FINT, inso: 31.9 },
    ]);
    const res = await provider().getSunshineNear(43.47, -3.79);

    expect(res).toHaveLength(1);
    expect(res[0].insoMin).toBe(31.9);
  });

  it('sin ninguna estación con insolación devuelve vacío', async () => {
    mockAemet(OBSERVACIONES.filter((o) => o.inso === undefined));
    expect(await provider().getSunshineNear(43.47, -3.79)).toEqual([]);
  });

  it('si AEMET falla devuelve vacío en vez de lanzar', async () => {
    vi.spyOn(http, 'get').mockRejectedValue(new Error('503'));
    expect(await provider().getSunshineNear(43.47, -3.79)).toEqual([]);
  });
});

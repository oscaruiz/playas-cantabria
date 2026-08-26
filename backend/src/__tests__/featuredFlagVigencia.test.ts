import { describe, it, expect, vi, afterEach } from 'vitest';
import { GetFeaturedBeaches } from '../domain/use-cases/GetFeaturedBeaches';
import { InMemoryCache } from '../infrastructure/cache/InMemoryCache';
import type { Beach } from '../domain/entities/Beach';
import type { FlagStatus } from '../domain/entities/Flag';

/**
 * Observed live at 23:49: the same object published `bandera: null` — correct,
 * the lifeguards had gone home hours earlier — and, right next to it,
 * `razonRanking: "...bandera verde"` plus the 20 points that flag is worth.
 *
 * The validity rule lived only in the mapper, so the interface refused to paint
 * a colour while the score kept crediting it. The app contradicted itself and
 * inflated its own rating overnight.
 */

const PLAYA: Beach = {
  id: '3900001',
  name: 'Playa de Prueba',
  municipality: 'Prueba',
  aemetCode: '3900001',
  latitude: 43.4,
  longitude: -4,
  sinAemet: true,
  flagRef: { provider: 'cruzroja', ref: 1 },
};

/** Green flag captured today, with the lifeguard day already closed. */
function banderaFueraDeHorario(ahora: Date): FlagStatus {
  return {
    color: 'green',
    timestamp: ahora.getTime() - 4 * 3600_000,
    coverageFrom: '01-06-2026',
    coverageTo: '30-09-2026',
    schedule: '11:30 - 19:30',
  };
}

function construir(flag: FlagStatus | null) {
  const repo = { getAll: async () => [PLAYA], getById: async () => PLAYA };
  const clima = {
    getCurrentByCoords: async () => ({
      source: 'OpenWeather' as const,
      timestamp: Date.now(),
      temperatureC: 24,
      description: 'cielo claro',
      icon: '01d',
      windSpeedMs: 2,
      windDirectionDeg: 0,
      humidityPct: 50,
      pressureHPa: 1013,
    }),
  };
  const flags = { getFlag: async () => flag };
  const forecast = { getByBeachCode: async () => { throw new Error('sin ficha'); } };
  const lluvia = { execute: async () => null };

  return new GetFeaturedBeaches(
    repo as never, clima as never, clima as never, flags as never,
    forecast as never, new InMemoryCache(), lluvia as never,
    undefined, 'prueba', ['Cruz Roja'],
  );
}

/**
 * La hora se congela: el horario de vigilancia es 11:30–19:30, así que sin
 * congelarla estos dos casos SOLO pasaban si la suite corría de noche. Fallaban
 * a las 13:41 de un martes y aprobaban a las 23:00 sin que cambiara una línea.
 */
const MEDIANOCHE = new Date('2026-08-01T21:00:00Z'); // 23:00 Madrid

afterEach(() => vi.useRealTimers());

describe('GetFeaturedBeaches — banderas fuera de horario', () => {
  it('no puntúa ni menciona una bandera que ya no está izada', async () => {
    vi.setSystemTime(MEDIANOCHE);
    const { resumenTodas } = await construir(banderaFueraDeHorario(MEDIANOCHE)).execute();
    const playa = resumenTodas[0];

    expect(playa.flag).toBeNull();
    expect(playa.reason).not.toContain('bandera verde');
  });

  it('la nota es la misma que sin bandera, no la de una bandera verde', async () => {
    vi.setSystemTime(MEDIANOCHE);
    const conBanderaCaducada = await construir(banderaFueraDeHorario(MEDIANOCHE)).execute();
    const sinBandera = await construir(null).execute();

    expect(conBanderaCaducada.resumenTodas[0].score).toBe(sinBandera.resumenTodas[0].score);
  });

  /**
   * Distinto de "fuera de horario": aquí SÍ hay servicio y lo que se ha perdido
   * es la entrega. Convertirlo en `null` devolvía la playa al ranking como si
   * nadie la vigilara — una bandera negra perdida dejaba de excluir.
   */
  function banderaCaducadaEnHorario(color: FlagStatus['color']): FlagStatus {
    return {
      color,
      timestamp: Date.now() - 25 * 3600_000,
      coverageFrom: '01-06-2026',
      coverageTo: '30-09-2026',
      schedule: '00:00 - 23:59',
    };
  }

  it('una bandera negra caducada en horario sigue excluyendo la playa', async () => {
    const { mejores, resumenTodas } = await construir(banderaCaducadaEnHorario('black')).execute();

    expect(mejores).toHaveLength(0);
    expect(resumenTodas[0].score).toBe(0);
    expect(resumenTodas[0].reason).toContain('Baño prohibido');
  });

  it('una bandera verde caducada en horario pasa a desconocida y no puntúa como verde', async () => {
    const caducada = await construir(banderaCaducadaEnHorario('green')).execute();
    const vigente = await construir({
      ...banderaCaducadaEnHorario('green'),
      timestamp: Date.now(),
    }).execute();

    expect(caducada.resumenTodas[0].flag?.color).toBe('unknown');
    expect(caducada.resumenTodas[0].reason).not.toContain('bandera verde');
    expect(caducada.resumenTodas[0].score).toBeLessThan(vigente.resumenTodas[0].score);
  });

  it('sigue contando la bandera dentro del horario', async () => {
    // Un horario que cubre todo el día: la bandera es vigente se ejecute cuando
    // se ejecute la suite, y debe sumar sus 10 puntos.
    const vigente: FlagStatus = {
      ...banderaFueraDeHorario(new Date()),
      schedule: '00:00 - 23:59',
    };
    const conBandera = await construir(vigente).execute();
    const sinBandera = await construir(null).execute();

    expect(conBandera.resumenTodas[0].flag?.color).toBe('green');
    expect(conBandera.resumenTodas[0].score).toBeGreaterThan(sinBandera.resumenTodas[0].score);
  });
});

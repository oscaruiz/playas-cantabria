import { describe, it, expect, vi, afterEach } from 'vitest';
import { GetFeaturedBeaches } from '../domain/use-cases/GetFeaturedBeaches';
import { InMemoryCache } from '../infrastructure/cache/InMemoryCache';
import type { Beach } from '../domain/entities/Beach';
import type { HourlyOutlookSlot, RainNowcast } from '../domain/entities/RainNowcast';

/**
 * El caso real: Tagle, 57 puntos a las 10:55 de un 1 de agosto. Cielo 10/25 por
 * un `04d` de nubes de mañana que en esta costa se abren a mediodía, sin ficha
 * de AEMET (código sintético) y sin bandera izada todavía. La nota juzgaba la
 * playa por su peor hora y no decía una palabra de que iba a mejorar.
 */

const TAGLE: Beach = {
  id: '3908599',
  name: 'Tagle',
  municipality: 'Suances',
  aemetCode: '3908599',
  latitude: 43.4275,
  longitude: -4.0914,
  sinAemet: true,
  attributes: { surf: true },
};

/** 13:00 Madrid: dentro de la franja, con 4 h por delante. */
const AHORA = new Date('2026-08-01T11:00:00Z');

function tramos(nubes: number): HourlyOutlookSlot[] {
  return Array.from({ length: 4 }, (_, i) => ({
    timestamp: AHORA.getTime() + (i + 1) * 3_600_000,
    cloudCoverPct: nubes,
    temperatureC: 20,
    windSpeedMs: 5.4,
  }));
}

function nowcast(outlook: HourlyOutlookSlot[] | null): RainNowcast {
  return {
    status: 'dry',
    precipitationMm: 0,
    lastHourOnly: false,
    sources: [],
    timestamp: AHORA.getTime(),
    upcoming: { expected: false, firstAt: null, mmMax: null },
    outlook,
  };
}

function construir(rain: RainNowcast) {
  const repo = { getAll: async () => [TAGLE], getById: async () => TAGLE };
  const clima = {
    getCurrentByCoords: async () => ({
      source: 'OpenWeather' as const,
      timestamp: AHORA.getTime(),
      temperatureC: 19.91,
      description: 'nubes',
      icon: '04d',
      windSpeedMs: 5.4,
      windDirectionDeg: 0,
      humidityPct: 70,
      pressureHPa: 1015,
    }),
  };
  const flags = { getFlag: async () => null };
  const forecast = { getByBeachCode: async () => { throw new Error('sin ficha'); } };
  const lluvia = { execute: async () => rain };

  return new GetFeaturedBeaches(
    repo as never, clima as never, clima as never, flags as never,
    forecast as never, new InMemoryCache(), lluvia as never,
    undefined, 'prueba', ['Cruz Roja'],
  );
}

afterEach(() => vi.useRealTimers());

describe('GetFeaturedBeaches — previsión de las próximas horas', () => {
  it('sin previsión, la nota es la de siempre: 59', async () => {
    vi.setSystemTime(AHORA);
    const { resumenTodas } = await construir(nowcast(null)).execute();

    expect(resumenTodas[0].score).toBe(59);
  });

  it('si el cielo se abre, sube y lo dice', async () => {
    vi.setSystemTime(AHORA);
    const { resumenTodas } = await construir(nowcast(tramos(0))).execute();
    const tagle = resumenTodas[0];

    // 59 + 8 = 67: cruza la banda verde (≥60) que decide el color del mapa.
    expect(tagle.score).toBe(67);
    expect(tagle.reason).toContain('mejora en las próximas horas');
  });

  it('si se cierra del todo, baja y aparece en el motivo, no en la razón', async () => {
    vi.setSystemTime(AHORA);
    // Ahora 04d (>50% nubes) ya es el peor tramo de cielo, así que para que
    // empeore de verdad tiene que caer la temperatura y subir el viento.
    const empeorando = nowcast(
      Array.from({ length: 4 }, (_, i) => ({
        timestamp: AHORA.getTime() + (i + 1) * 3_600_000,
        cloudCoverPct: 100,
        temperatureC: 13,
        windSpeedMs: 14,
      })),
    );

    const { resumenTodas } = await construir(empeorando).execute();
    const tagle = resumenTodas[0];

    expect(tagle.score).toBeLessThan(59);
    expect(tagle.downgradeReason).toContain('empeora en las próximas horas');
    expect(tagle.reason).not.toContain('próximas horas');
  });

  it('publica POR QUÉ se mueve, no solo hacia dónde', async () => {
    vi.setSystemTime(AHORA);
    const { resumenTodas } = await construir(nowcast(tramos(0))).execute();

    expect(resumenTodas[0].outlook?.causa).toBe('despeja');
  });

  it('de noche no se toca la nota: no hay franja que anticipar', async () => {
    const medianoche = new Date('2026-08-01T22:00:00Z'); // 00:00 Madrid
    vi.setSystemTime(medianoche);

    const { resumenTodas } = await construir(
      nowcast(
        Array.from({ length: 4 }, (_, i) => ({
          timestamp: medianoche.getTime() + (i + 1) * 3_600_000,
          cloudCoverPct: 0,
          temperatureC: 20,
          windSpeedMs: 5.4,
        })),
      ),
    ).execute();

    expect(resumenTodas[0].score).toBe(59);
  });
});

// ---------------------------------------------------------------------------
// La ventana del día: CUÁNDO ir, no solo si la playa está bien ahora
// ---------------------------------------------------------------------------

describe('GetFeaturedBeaches — ventana del día', () => {
  it('publica la mejor franja construida sobre los mismos tramos del nowcast', async () => {
    vi.setSystemTime(AHORA);
    const { resumenTodas } = await construir(nowcast(tramos(0))).execute();
    const ventana = resumenTodas[0].ventanaDia;

    // Cuatro horas buenas contiguas desde las 14:00 Madrid (12:00 UTC).
    expect(ventana?.mejor).toEqual({
      inicio: AHORA.getTime() + 3_600_000,
      fin: AHORA.getTime() + 5 * 3_600_000,
    });
    expect(ventana?.cambio).toBeNull();
  });

  it('sin tramos de Open-Meteo no hay ventana, y nada más se rompe', async () => {
    vi.setSystemTime(AHORA);
    const { resumenTodas } = await construir(nowcast(null)).execute();

    expect(resumenTodas[0].ventanaDia).toBeNull();
    expect(resumenTodas[0].score).toBe(59);
  });
});

// ---------------------------------------------------------------------------
// La lluvia prevista manda en lo que se cuenta, sin tocar lo que puntúa
// ---------------------------------------------------------------------------

describe('GetFeaturedBeaches — lluvia prevista sobre un cielo que se abre', () => {
  /** El cielo se despeja Y Open-Meteo anuncia chubascos: los dos a la vez. */
  function conLluviaPrevista(): RainNowcast {
    return {
      ...nowcast(tramos(0)),
      upcoming: { expected: true, firstAt: AHORA.getTime() + 2 * 3_600_000, mmMax: 1.2 },
    };
  }

  it('la causa publicada es la lluvia, no el cielo', async () => {
    vi.setSystemTime(AHORA);
    const { resumenTodas } = await construir(conLluviaPrevista()).execute();

    expect(resumenTodas[0].outlook?.direccion).toBe('empeora');
    expect(resumenTodas[0].outlook?.causa).toBe('lluvia_prevista');
  });

  it('el motivo no dice dos veces lo mismo (regresión)', async () => {
    vi.setSystemTime(AHORA);
    const { resumenTodas } = await construir(conLluviaPrevista()).execute();
    const tagle = resumenTodas[0];
    const textos = `${tagle.reason} ${tagle.downgradeReason ?? ''}`;

    // Si el pronóstico resuelto llegara a los constructores de motivo, su
    // `direccion: 'empeora'` añadiría "empeora en las próximas horas" pegado al
    // "lluvia prevista" que esos mismos constructores ya ponen.
    expect(textos).toContain('lluvia prevista');
    expect(textos).not.toContain('empeora en las próximas horas');
  });

  it('la nota la sigue decidiendo el algoritmo de siempre', async () => {
    vi.setSystemTime(AHORA);
    const { resumenTodas } = await construir(conLluviaPrevista()).execute();
    const tagle = resumenTodas[0];

    // El +8 del cielo entró en la puntuación (59 → 67) y después lo recortó el
    // tope de lluvia prevista. Nombrar la lluvia en el chip no movió nada de eso.
    expect(tagle.subScores?.pronostico).toBe(8);
    expect(tagle.score).toBe(59);
    expect(tagle.tope).toBe('lluvia_prevista');
  });
});

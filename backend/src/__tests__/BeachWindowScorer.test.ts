import { describe, it, expect } from 'vitest';
import { buildDayWindow } from '../domain/use-cases/BeachWindowScorer';
import type { HourlyOutlookSlot } from '../domain/entities/RainNowcast';

/**
 * La feature que lo motivó: en vez de solo "Somo — 86/100", decir CUÁNDO —
 * "Mejor momento: 11:00–14:00 · a partir de las 17:00 aumenta el viento".
 * Madrid en julio es UTC+2: la franja de playa 11:00–21:00 son 09:00–19:00 UTC.
 */

// 10:00 Madrid.
const MEDIA_MANANA = new Date('2026-07-15T08:00:00Z');

const HORA = 3_600_000;
const utc = (hora: number) => Date.UTC(2026, 6, 15, hora);

/** cielo 25 + temperatura 23 + viento 15 = 63/65 → calidad 97. */
const BUENA: Partial<HourlyOutlookSlot> = { cloudCoverPct: 5, temperatureC: 24, windSpeedMs: 2 };
/** El vendaval con sol: 50/65 → 77. Un umbral absoluto de 60 no lo vería. */
const VENTOSA: Partial<HourlyOutlookSlot> = { cloudCoverPct: 5, temperatureC: 24, windSpeedMs: 16 };
/** Cielo cerrado: 48/65 → 74. */
const NUBLADA: Partial<HourlyOutlookSlot> = { cloudCoverPct: 90, temperatureC: 24, windSpeedMs: 2 };

function slot(horaUtc: number, valores: Partial<HourlyOutlookSlot>): HourlyOutlookSlot {
  return {
    timestamp: utc(horaUtc),
    cloudCoverPct: null,
    temperatureC: null,
    windSpeedMs: null,
    ...valores,
  };
}

function slots(horasUtc: number[], valores: Partial<HourlyOutlookSlot>): HourlyOutlookSlot[] {
  return horasUtc.map((h) => slot(h, valores));
}

describe('buildDayWindow — la mejor franja del día', () => {
  it('el caso pedido: buena mañana y viento por la tarde', () => {
    const dia = [...slots([9, 10, 11, 12, 13, 14], BUENA), ...slots([15, 16, 17], VENTOSA)];
    const señal = buildDayWindow(dia, MEDIA_MANANA);

    // El tramo de las 09:00 UTC queda fuera (la franja empieza a las 09:00 en
    // punto y el filtro es estricto, como en `ventanaOutlook`).
    expect(señal?.mejor).toEqual({ inicio: utc(10), fin: utc(15) });
    // 17:00 Madrid: se levanta el viento.
    expect(señal?.cambio).toEqual({ desde: utc(15), causa: 'arrecia_viento' });
    expect(señal?.horasConsideradas).toBe(8);
  });

  it('una hora de lluvia parte el día y nunca se recomienda', () => {
    const dia = [
      ...slots([10, 11, 12], BUENA),
      slot(13, { ...BUENA, precipitationMm: 0.4 }),
      ...slots([14, 15, 16, 17], BUENA),
    ];
    const señal = buildDayWindow(dia, MEDIA_MANANA);

    // Gana el tramo más largo, el de después del chubasco.
    expect(señal?.mejor).toEqual({ inicio: utc(14), fin: utc(18) });
    // Tras el tramo no queda ninguna hora evaluada mala: nada que avisar.
    expect(señal?.cambio).toBeNull();
  });

  it('un día malo no tiene "mejor momento": recomendar la hora menos mala vestiría un aviso de consejo', () => {
    const gris = slots([10, 11, 12, 13, 14, 15], { cloudCoverPct: 90, temperatureC: 15, windSpeedMs: 8 });
    expect(buildDayWindow(gris, MEDIA_MANANA)).toBeNull();
  });

  it('el listón es relativo al pico: una tarde nublada queda fuera aunque apruebe en absoluto', () => {
    const dia = [...slots([10, 11, 12, 13], BUENA), ...slots([14, 15], NUBLADA)];
    const señal = buildDayWindow(dia, MEDIA_MANANA);

    expect(señal?.mejor).toEqual({ inicio: utc(10), fin: utc(14) });
    expect(señal?.cambio).toEqual({ desde: utc(14), causa: 'nubla' });
  });

  it('la lluvia prevista se nombra como tal, no como el factor que arrastra', () => {
    const dia = [...slots([10, 11, 12, 13], BUENA), slot(14, { ...BUENA, precipitationMm: 1.2 })];
    const señal = buildDayWindow(dia, MEDIA_MANANA);

    expect(señal?.cambio).toEqual({ desde: utc(14), causa: 'lluvia_prevista' });
  });

  it('acepta el paso de 3 h del suplente (OpenWeather) y recorta el fin a la franja', () => {
    const dia = [...slots([9, 12, 15], BUENA), slot(18, VENTOSA)];
    const señal = buildDayWindow(dia, MEDIA_MANANA);

    // 12:00 y 15:00 UTC contiguos a paso de 3 h; fin = 15:00 + 3 h = 18:00 UTC
    // (20:00 Madrid), dentro de la franja.
    expect(señal?.mejor).toEqual({ inicio: utc(12), fin: utc(18) });
    expect(señal?.cambio).toEqual({ desde: utc(18), causa: 'arrecia_viento' });
  });

  it('a empate de duración y calidad gana el tramo más temprano: "ve ya" es el consejo útil', () => {
    const dia = [
      ...slots([10, 11], BUENA),
      slot(12, NUBLADA),
      ...slots([13, 14], BUENA),
    ];
    const señal = buildDayWindow(dia, MEDIA_MANANA);

    expect(señal?.mejor).toEqual({ inicio: utc(10), fin: utc(12) });
  });

  it('de noche, sin tramos o con menos de dos utilizables no hay señal', () => {
    const medianoche = new Date('2026-07-15T22:00:00Z');
    expect(buildDayWindow(slots([23], BUENA), medianoche)).toBeNull();

    expect(buildDayWindow([], MEDIA_MANANA)).toBeNull();
    expect(buildDayWindow(null, MEDIA_MANANA)).toBeNull();
    expect(buildDayWindow(slots([10], BUENA), MEDIA_MANANA)).toBeNull();
  });

  it('un tramo sin ninguna variable no se certifica ni bueno ni malo: no cuenta', () => {
    const dia = [
      ...slots([10, 11, 12], {}),
      ...slots([13, 14], BUENA),
    ];
    const señal = buildDayWindow(dia, MEDIA_MANANA);

    expect(señal?.mejor).toEqual({ inicio: utc(13), fin: utc(15) });
    expect(señal?.horasConsideradas).toBe(2);
  });
});

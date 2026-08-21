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

    // El slot de las 09:00 UTC abre la franja (11:00 Madrid): desde que la
    // hora en curso cuenta, un tramo puede empezar en el arranque mismo.
    expect(señal?.mejor).toEqual({ inicio: utc(9), fin: utc(15) });
    // 17:00 Madrid: se levanta el viento.
    expect(señal?.cambio).toEqual({ desde: utc(15), causa: 'arrecia_viento' });
    // Y el motivo dice por qué ESE tramo: fuera de él sopla más.
    expect(señal?.motivo).toBe('amaina_viento');
    expect(señal?.horasConsideradas).toBe(9);
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
    // Con lluvia fuera del tramo, el motivo es esquivarla — nada pesa más.
    expect(señal?.motivo).toBe('sin_lluvia');
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
    // Motivo y cambio son la misma historia desde dos lados: más despejado
    // dentro, se nubla después.
    expect(señal?.motivo).toBe('despeja');
  });

  it('la lluvia prevista se nombra como tal, no como el factor que arrastra', () => {
    const dia = [...slots([10, 11, 12, 13], BUENA), slot(14, { ...BUENA, precipitationMm: 1.2 })];
    const señal = buildDayWindow(dia, MEDIA_MANANA);

    expect(señal?.cambio).toEqual({ desde: utc(14), causa: 'lluvia_prevista' });
  });

  it('acepta el paso de 3 h del suplente (OpenWeather) y recorta el fin a la franja', () => {
    const dia = [...slots([9, 12, 15], BUENA), slot(18, VENTOSA)];
    const señal = buildDayWindow(dia, MEDIA_MANANA);

    // 09:00, 12:00 y 15:00 UTC contiguos a paso de 3 h (la hora en curso
    // cuenta); fin = 15:00 + 3 h = 18:00 UTC (20:00 Madrid), dentro de la franja.
    expect(señal?.mejor).toEqual({ inicio: utc(9), fin: utc(18) });
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

  it('la hora en curso cuenta y el inicio publicado se recorta a "ahora"', () => {
    // 11:30 Madrid: el slot de las 09:00 UTC (11:00 Madrid) va por la mitad.
    const yEnCurso = new Date('2026-07-15T09:30:00Z');
    const señal = buildDayWindow(slots([9, 10, 11, 12, 13], BUENA), yEnCurso);

    // El tramo arranca en la hora en curso, pero nunca se anuncia un inicio
    // en el pasado: se publica "ahora".
    expect(señal?.mejor).toEqual({ inicio: yEnCurso.getTime(), fin: utc(14) });
    expect(señal?.horasConsideradas).toBe(5);
  });

  it('lluvia AHORA veta la próxima hora aunque el modelo diga seco', () => {
    // 11:30 Madrid, lloviendo según el nowcast; la previsión (BUENA) dice
    // seco todo el día — que es exactamente el caso en que el modelo ya ha
    // quedado desmentido y no puede recomendar salir ya.
    const lloviendo = new Date('2026-07-15T09:30:00Z');
    const señal = buildDayWindow(slots([9, 10, 11, 12, 13], BUENA), lloviendo, {
      status: 'raining',
    });

    // Los slots de las 09:00 y 10:00 UTC (en curso y siguiente) caen dentro
    // del veto de una hora: el tramo recomendable empieza a las 13:00 Madrid.
    expect(señal?.mejor).toEqual({ inicio: utc(11), fin: utc(14) });
    // Y el motivo cuenta la verdad: es el tramo sin lluvia.
    expect(señal?.motivo).toBe('sin_lluvia');
  });

  it('lloviendo y con menos de una hora de franja por delante, no hay recomendación', () => {
    const tarde = new Date('2026-07-15T17:30:00Z'); // 19:30 Madrid
    expect(
      buildDayWindow(slots([17, 18], BUENA), tarde, { status: 'raining' }),
    ).toBeNull();
  });

  it('con el nowcast seco (o ausente) el veto no existe y nada cambia', () => {
    const señal = buildDayWindow(slots([10, 11, 12, 13, 14], BUENA), MEDIA_MANANA, {
      status: 'dry',
    });
    expect(señal?.mejor).toEqual({ inicio: utc(10), fin: utc(15) });
  });

  it('un día entero de viento fuerte no se recomienda: la puerta gana a la nota', () => {
    // Sol y 24° con 10 m/s normalizan a ~81: por encima del suelo y, siendo
    // el día uniforme, del listón relativo. El mapa avisa de ese viento; la
    // ventana no puede recomendarlo a la vez.
    const ventoso = slots([10, 11, 12, 13, 14, 15], {
      cloudCoverPct: 5, temperatureC: 24, windSpeedMs: 10,
    });
    expect(buildDayWindow(ventoso, MEDIA_MANANA)).toBeNull();
  });

  it('un día despejado pero frío tampoco: al sol con 15° no es plan de playa', () => {
    const frio = slots([10, 11, 12, 13, 14], {
      cloudCoverPct: 5, temperatureC: 15, windSpeedMs: 2,
    });
    expect(buildDayWindow(frio, MEDIA_MANANA)).toBeNull();
  });

  it('mañana fría que templa por la tarde: se recomienda la tarde, por más cálida', () => {
    const dia = [
      ...slots([10, 11], { cloudCoverPct: 5, temperatureC: 15, windSpeedMs: 2 }),
      ...slots([12, 13, 14, 15], { cloudCoverPct: 5, temperatureC: 22, windSpeedMs: 2 }),
    ];
    const señal = buildDayWindow(dia, MEDIA_MANANA);

    expect(señal?.mejor).toEqual({ inicio: utc(12), fin: utc(16) });
    expect(señal?.motivo).toBe('sube_temperatura');
  });

  it('un tramo que cubre toda la franja restante no tiene motivo: no venció a nadie', () => {
    const señal = buildDayWindow(slots([10, 11, 12, 13, 14], BUENA), MEDIA_MANANA);

    expect(señal?.mejor).toEqual({ inicio: utc(10), fin: utc(15) });
    expect(señal?.cambio).toBeNull();
    expect(señal?.motivo).toBeNull();
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

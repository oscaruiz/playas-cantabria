import { describe, it, expect } from 'vitest';
import {
  buildWeatherOutlook,
  resolvePublishedOutlook,
  ventanaOutlook,
} from '../domain/use-cases/WeatherOutlook';
import { OUTLOOK_MAX_DELTA } from '../domain/use-cases/BeachScorer';
import type { Weather } from '../domain/entities/Weather';
import type { HourlyOutlookSlot } from '../domain/entities/RainNowcast';
import type { RainForecastSignal } from '../domain/use-cases/RainForecast';

/**
 * El caso que lo motivó: Tagle, 57 puntos a las 10:55 con un `04d` de nubes de
 * mañana que en esta costa se abren a mediodía. La nota juzgaba la playa por la
 * peor hora del día y no decía nada de que iba a mejorar.
 */

// 12:00 Madrid en verano = 10:00 UTC.
const MEDIODIA = new Date('2026-07-15T10:00:00Z');

function weather(overrides: Partial<Weather> = {}): Weather {
  return {
    source: 'OpenWeather',
    timestamp: MEDIODIA.getTime(),
    temperatureC: 20,
    description: 'nubes',
    icon: '04d', // cielo 10/25
    windSpeedMs: 3,
    windDirectionDeg: 0,
    humidityPct: 60,
    pressureHPa: 1015,
    ...overrides,
  };
}

/** `horas` tramos horarios a partir de `desde`, todos con el mismo tiempo. */
function tramos(
  desde: Date,
  horas: number,
  valores: Partial<HourlyOutlookSlot>,
): HourlyOutlookSlot[] {
  return Array.from({ length: horas }, (_, i) => ({
    timestamp: desde.getTime() + (i + 1) * 3_600_000,
    cloudCoverPct: null,
    temperatureC: null,
    windSpeedMs: null,
    ...valores,
  }));
}

describe('ventanaOutlook', () => {
  it('coge las próximas 4 h y descarta lo ya pasado', () => {
    const slots = [
      { timestamp: MEDIODIA.getTime() - 3_600_000, cloudCoverPct: 0, temperatureC: null, windSpeedMs: null },
      ...tramos(MEDIODIA, 6, { cloudCoverPct: 0 }),
    ];

    expect(ventanaOutlook(slots, MEDIODIA)).toHaveLength(4);
  });

  it('recorta al final de la franja de playa (21:00 Madrid)', () => {
    const lasOchoYMedia = new Date('2026-07-15T18:30:00Z'); // 20:30 Madrid
    const slots = tramos(lasOchoYMedia, 4, { cloudCoverPct: 0 });

    // Solo queda media hora de franja: ningún tramo horario entra.
    expect(ventanaOutlook(slots, lasOchoYMedia)).toHaveLength(0);
  });

  it('a media mañana mira la franja que viene, no la hora muerta', () => {
    const lasNueve = new Date('2026-07-15T07:00:00Z'); // 09:00 Madrid
    const slots = tramos(lasNueve, 4, { cloudCoverPct: 0 }); // 10:00..13:00 Madrid

    // La ventana empieza a las 11:00: entran los tramos de 12:00 y 13:00.
    const ventana = ventanaOutlook(slots, lasNueve);
    expect(ventana).toHaveLength(2);
  });

  it('de noche no hay nada que anticipar', () => {
    const medianoche = new Date('2026-07-15T22:00:00Z'); // 00:00 Madrid
    expect(ventanaOutlook(tramos(medianoche, 4, { cloudCoverPct: 0 }), medianoche)).toHaveLength(0);
  });

  it('la ventana nunca pasa de 4 h desde ahora, ni en la peor frontera', () => {
    // 08:01 Madrid: el inicio se desplaza a las 11:00, pero el FINAL sigue
    // siendo ahora+4h (12:01), así que nunca hacen falta más tramos de los que
    // el proveedor pide con `forecast_hours`. Si el final se desplazara con el
    // inicio, la petición se quedaría corta.
    const lasOchoYUno = new Date('2026-07-15T06:01:00Z'); // 08:01 Madrid
    const slots = tramos(lasOchoYUno, 8, { cloudCoverPct: 0 }); // 09:01..16:01 Madrid

    const ventana = ventanaOutlook(slots, lasOchoYUno);
    const ultimo = ventana[ventana.length - 1];

    expect(ventana.length).toBeGreaterThan(0);
    expect(ultimo.timestamp - lasOchoYUno.getTime()).toBeLessThanOrEqual(4 * 3_600_000);
  });
});

describe('buildWeatherOutlook', () => {
  it('sube cuando el cielo se abre (caso Tagle)', () => {
    const señal = buildWeatherOutlook(weather(), tramos(MEDIODIA, 4, { cloudCoverPct: 5 }), MEDIODIA);

    expect(señal?.direccion).toBe('mejora');
    expect(señal!.delta).toBeGreaterThan(0);
    expect(señal!.horasConsideradas).toBe(4);
  });

  it('baja cuando se nubla y entra viento', () => {
    const soleada = weather({ icon: '01d', windSpeedMs: 2 });
    const señal = buildWeatherOutlook(
      soleada,
      tramos(MEDIODIA, 4, { cloudCoverPct: 95, windSpeedMs: 14 }),
      MEDIODIA,
    );

    expect(señal?.direccion).toBe('empeora');
    expect(señal!.delta).toBeLessThan(0);
  });

  it('nunca se sale de ±OUTLOOK_MAX_DELTA', () => {
    const peor = buildWeatherOutlook(
      weather({ icon: '01d', temperatureC: 26, windSpeedMs: 1 }),
      tramos(MEDIODIA, 4, { cloudCoverPct: 100, temperatureC: 8, windSpeedMs: 20 }),
      MEDIODIA,
    );
    const mejor = buildWeatherOutlook(
      weather({ icon: '04d', temperatureC: 12, windSpeedMs: 18 }),
      tramos(MEDIODIA, 4, { cloudCoverPct: 0, temperatureC: 25, windSpeedMs: 1 }),
      MEDIODIA,
    );

    expect(peor!.delta).toBe(-OUTLOOK_MAX_DELTA);
    expect(mejor!.delta).toBe(OUTLOOK_MAX_DELTA);
  });

  it('el caso Tagle llega al máximo: nubes cerradas que se abren del todo', () => {
    // 04d (10/25) → cielo despejado (25/25) = +15 puntos de cielo, de los que
    // se anticipa la mitad → 7,5, recortado al tope. Es el ejemplo aprobado:
    // una playa a 57 cruza la banda verde.
    const soloCielo = buildWeatherOutlook(
      weather({ icon: '04d' }),
      tramos(MEDIODIA, 4, { cloudCoverPct: 0 }),
      MEDIODIA,
    );

    expect(soloCielo!.delta).toBe(OUTLOOK_MAX_DELTA);
  });

  it('un factor sin previsión no resta: aporta 0, no encoge a los demás', () => {
    const conTemperatura = buildWeatherOutlook(
      weather({ icon: '04d' }),
      tramos(MEDIODIA, 4, { cloudCoverPct: 30, temperatureC: 20 }),
      MEDIODIA,
    );
    const sinTemperatura = buildWeatherOutlook(
      weather({ icon: '04d' }),
      tramos(MEDIODIA, 4, { cloudCoverPct: 30 }),
      MEDIODIA,
    );

    // La temperatura prevista es la misma que la actual (20°): no aporta nada,
    // y su ausencia tampoco cambia el resultado.
    expect(sinTemperatura!.delta).toBe(conTemperatura!.delta);
  });

  it('sin tramos, sin observación o fuera de franja no hay señal', () => {
    expect(buildWeatherOutlook(weather(), [], MEDIODIA)).toBeNull();
    expect(buildWeatherOutlook(weather(), null, MEDIODIA)).toBeNull();
    expect(buildWeatherOutlook(null, tramos(MEDIODIA, 4, { cloudCoverPct: 0 }), MEDIODIA)).toBeNull();

    const medianoche = new Date('2026-07-15T22:00:00Z');
    expect(buildWeatherOutlook(weather(), tramos(medianoche, 4, { cloudCoverPct: 0 }), medianoche)).toBeNull();
  });

  it('un cambio pequeño se queda en estable y no genera texto', () => {
    // 04d ahora (>50% nubes) y 60% previsto: mismo tramo de puntuación.
    const señal = buildWeatherOutlook(
      weather({ temperatureC: 20, windSpeedMs: 3 }),
      tramos(MEDIODIA, 4, { cloudCoverPct: 60, temperatureC: 20, windSpeedMs: 3 }),
      MEDIODIA,
    );

    expect(señal?.direccion).toBe('estable');
    expect(señal!.delta).toBe(0);
  });
});

describe('el ruido no mueve la nota', () => {
  it('un cambio por debajo del umbral se queda en 0, no en ±1', () => {
    // Con un +1 la tarjeta decía "Sin cambios · +1 puntos" y el desglose
    // sumaba 63 junto a una nota de 64: los números en pantalla tienen que
    // cuadrar o la explicación deja de explicar nada.
    const casi = buildWeatherOutlook(
      weather({ temperatureC: 20, windSpeedMs: 3 }),
      tramos(MEDIODIA, 4, { cloudCoverPct: 60, temperatureC: 20.8, windSpeedMs: 3 }),
      MEDIODIA,
    );

    expect(casi!.delta).toBe(0);
    expect(casi!.direccion).toBe('estable');
  });
});

// ---------------------------------------------------------------------------
// Por qué se mueve, no solo hacia dónde
// ---------------------------------------------------------------------------

describe('causa dominante', () => {
  it('nombra el cielo cuando es lo que abre la tarde', () => {
    const señal = buildWeatherOutlook(weather(), tramos(MEDIODIA, 4, { cloudCoverPct: 5 }), MEDIODIA);

    expect(señal?.causa).toBe('despeja');
  });

  it('nombra el viento cuando es lo que estropea la tarde', () => {
    // Cielo y temperatura clavados: el único que se mueve es el viento.
    const señal = buildWeatherOutlook(
      weather({ icon: '04d', temperatureC: 20, windSpeedMs: 2 }),
      tramos(MEDIODIA, 4, { cloudCoverPct: 60, temperatureC: 20, windSpeedMs: 16 }),
      MEDIODIA,
    );

    expect(señal?.direccion).toBe('empeora');
    expect(señal?.causa).toBe('arrecia_viento');
  });

  it('amaina el viento: mismo factor, sentido contrario', () => {
    const señal = buildWeatherOutlook(
      weather({ icon: '04d', temperatureC: 20, windSpeedMs: 14 }),
      tramos(MEDIODIA, 4, { cloudCoverPct: 60, temperatureC: 20, windSpeedMs: 1 }),
      MEDIODIA,
    );

    expect(señal?.direccion).toBe('mejora');
    expect(señal?.causa).toBe('amaina_viento');
  });

  it('con factores en sentidos opuestos gana el que arrastra la nota', () => {
    // El cielo se abre del todo (+7,5 de aporte) mientras entra viento (−2,4).
    // Neto positivo: la causa es el cielo. Coger el mayor en valor absoluto sin
    // mirar el signo anunciaría "mejora · se levanta viento".
    const señal = buildWeatherOutlook(
      weather({ icon: '04d', temperatureC: 20, windSpeedMs: 2 }),
      tramos(MEDIODIA, 4, { cloudCoverPct: 0, temperatureC: 20, windSpeedMs: 9 }),
      MEDIODIA,
    );

    expect(señal?.direccion).toBe('mejora');
    expect(señal?.causa).toBe('despeja');
  });

  it('en ola de calor la nota mejora BAJANDO la temperatura', () => {
    // `computeTemperatureScore` no es monótona: por encima de 30° baja. Al
    // refrescar de 40° a 26° la puntuación SUBE, y decir "sube la temperatura"
    // sería falso justo el día en que todo el mundo mira el termómetro. La
    // causa se lee de los grados, no de los puntos.
    //
    // Hacen falta 14 grados de diferencia porque la temperatura pesa 0,3 y en
    // este tramo solo puede mover 11 puntos: es el extremo del rango, y el
    // único sitio donde el signo de los grados y el de los puntos discrepan.
    const señal = buildWeatherOutlook(
      weather({ icon: '04d', temperatureC: 40, windSpeedMs: 3 }),
      tramos(MEDIODIA, 4, { cloudCoverPct: 60, temperatureC: 26, windSpeedMs: 3 }),
      MEDIODIA,
    );

    expect(señal?.direccion).toBe('mejora');
    expect(señal?.causa).toBe('baja_temperatura');
  });

  it('un cambio que no puntúa tampoco se nombra', () => {
    const señal = buildWeatherOutlook(
      weather({ temperatureC: 20, windSpeedMs: 3 }),
      tramos(MEDIODIA, 4, { cloudCoverPct: 60, temperatureC: 20.8, windSpeedMs: 3 }),
      MEDIODIA,
    );

    expect(señal!.delta).toBe(0);
    expect(señal!.causa).toBeNull();
  });
});

describe('resolvePublishedOutlook', () => {
  const lluvia = (expected: boolean): RainForecastSignal => ({
    expected,
    firstAt: expected ? MEDIODIA.getTime() + 2 * 3_600_000 : null,
    mmMax: expected ? 1.2 : null,
    sources: expected ? ['OpenMeteo'] : [],
  });

  const despejando = buildWeatherOutlook(weather(), tramos(MEDIODIA, 4, { cloudCoverPct: 5 }), MEDIODIA);

  it('sin lluvia prevista devuelve el pronóstico intacto', () => {
    expect(resolvePublishedOutlook(despejando, lluvia(false))).toEqual(despejando);
    expect(resolvePublishedOutlook(despejando, null)).toEqual(despejando);
  });

  it('la lluvia prevista manda: es lo que más cambia el plan', () => {
    const publicado = resolvePublishedOutlook(despejando, lluvia(true));

    expect(publicado?.direccion).toBe('empeora');
    expect(publicado?.causa).toBe('lluvia_prevista');
  });

  it('no toca el delta: la lluvia puntúa por los topes, no por aquí', () => {
    const publicado = resolvePublishedOutlook(despejando, lluvia(true));

    expect(publicado?.delta).toBe(despejando!.delta);
  });

  it('habla aunque el cielo no se mueva, que es cuando más falta hace', () => {
    // Sin señal horaria de Open-Meteo no había nada que decir, y una playa a la
    // que le va a caer un chubasco se quedaba muda.
    const publicado = resolvePublishedOutlook(null, lluvia(true));

    expect(publicado).toEqual({
      delta: 0,
      direccion: 'empeora',
      horasConsideradas: 0,
      causa: 'lluvia_prevista',
    });
  });

  it('sin nada que resolver no inventa una señal', () => {
    expect(resolvePublishedOutlook(null, null)).toBeNull();
    expect(resolvePublishedOutlook(null, lluvia(false))).toBeNull();
  });
});

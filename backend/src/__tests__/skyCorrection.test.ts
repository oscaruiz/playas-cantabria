import { describe, it, expect } from 'vitest';
import {
  decidirCorreccionCielo,
  aplicarCorreccionCielo,
  ContextoCorreccion,
} from '../domain/services/skyCorrection';
import { Weather } from '../domain/entities/Weather';
import { SunshineObservation } from '../domain/entities/Sunshine';

const AHORA = Date.parse('2026-07-29T12:00:00.000Z');

/** Cielo despejado según el modelo: el caso que motiva todo esto. */
function despejado(extra: Partial<Weather> = {}): Weather {
  return {
    source: 'OpenWeather',
    timestamp: AHORA,
    temperatureC: 25.7,
    description: 'cielo claro',
    icon: '01d',
    conditionCode: 800,
    precipitationMm: null,
    cloudinessPct: 0,
    windSpeedMs: 3,
    windDirectionDeg: 310,
    humidityPct: 79,
    pressureHPa: 1018,
    ...extra,
  };
}

function obs(extra: Partial<SunshineObservation> = {}): SunshineObservation {
  return {
    insoMin: 0,
    fraccion: 0,
    distanciaKm: 5,
    idema: '1111X',
    ubicacion: 'SANTANDER CMT',
    observadoEn: AHORA - 10 * 60 * 1000,
    ...extra,
  };
}

const ctx = (extra: Partial<ContextoCorreccion> = {}): ContextoCorreccion => ({
  enFranjaDePlaya: true,
  ahora: AHORA,
  ...extra,
});

describe('decidirCorreccionCielo — el caso que lo motiva', () => {
  it('degrada a muy nuboso cuando el modelo dice despejado y no hubo sol', () => {
    // 29-jul: OpenWeather daba clouds.all 0 mientras Santander medía 0 min de sol.
    const d = decidirCorreccionCielo(despejado(), [obs({ insoMin: 0, fraccion: 0 })], ctx());
    expect(d.aplicar).toBe(true);
    expect(d.nivel).toBe('muyNuboso');
  });

  it('degrada a nubes dispersas con sol intermitente', () => {
    const d = decidirCorreccionCielo(
      despejado(),
      [obs({ insoMin: 31.9, fraccion: 31.9 / 60 })],
      ctx(),
    );
    expect(d.aplicar).toBe(true);
    expect(d.nivel).toBe('dispersas');
  });
});

describe('decidirCorreccionCielo — guardas', () => {
  it('no corrige fuera de la franja de playa', () => {
    // Sin esta guarda, la hora que contiene el amanecer marcaría "nublado" en un
    // día impecable, porque el sol estuvo bajo el horizonte parte de esa hora.
    const d = decidirCorreccionCielo(despejado(), [obs()], ctx({ enFranjaDePlaya: false }));
    expect(d).toMatchObject({ aplicar: false, motivo: 'fuera-de-franja' });
  });

  it('no corrige sin observación', () => {
    expect(decidirCorreccionCielo(despejado(), [], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'sin-observacion',
    });
  });

  it('no corrige con una observación de hace más de 2 h', () => {
    // La ventana stale de la caché llega a 3 h; esta guarda es la que impide
    // marcar "nublado" con un dato de esta mañana.
    const vieja = obs({ observadoEn: AHORA - 3 * 60 * 60 * 1000 });
    expect(decidirCorreccionCielo(despejado(), [vieja], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'observacion-vieja',
    });
  });

  it('no corrige si está lloviendo (manda el icono de lluvia)', () => {
    const porNowcast = decidirCorreccionCielo(despejado(), [obs()], ctx({ lloviendo: true }));
    expect(porNowcast).toMatchObject({ aplicar: false, motivo: 'lloviendo' });

    const porElPropioModelo = decidirCorreccionCielo(
      despejado({ conditionCode: 500, icon: '10d' }),
      [obs()],
      ctx(),
    );
    expect(porElPropioModelo).toMatchObject({ aplicar: false, motivo: 'lloviendo' });
  });

  it('no corrige con la estación a más de 40 km', () => {
    expect(decidirCorreccionCielo(despejado(), [obs({ distanciaKm: 48 })], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'estacion-lejos',
    });
  });

  it('entre 30 y 40 km exige un segundo testigo', () => {
    const lejos = obs({ distanciaKm: 35 });
    expect(decidirCorreccionCielo(despejado(), [lejos], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'sin-segundo-testigo',
    });

    const testigo = obs({ idema: '1109X', distanciaKm: 38, insoMin: 14, fraccion: 14 / 60 });
    expect(decidirCorreccionCielo(despejado(), [lejos, testigo], ctx()).aplicar).toBe(true);
  });

  it('un segundo testigo que ve sol NO corrobora', () => {
    const lejos = obs({ distanciaKm: 35 });
    const soleado = obs({ idema: '1109X', distanciaKm: 38, insoMin: 60, fraccion: 1 });
    expect(decidirCorreccionCielo(despejado(), [lejos, soleado], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'sin-segundo-testigo',
    });
  });

  it('el testigo debe ver AL MENOS tanta nube como la estación principal', () => {
    // 44 de 60 minutos de sol no confirma un "muy nuboso": es casi despejado.
    // Con la regla laxa anterior habría bastado con que no estuviera del todo
    // soleado, que es justo lo contrario de corroborar.
    const sinSol = obs({ distanciaKm: 35, insoMin: 0, fraccion: 0 });
    const casiDespejado = obs({ idema: '1109X', distanciaKm: 38, insoMin: 44, fraccion: 44 / 60 });
    expect(decidirCorreccionCielo(despejado(), [sinSol, casiDespejado], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'sin-segundo-testigo',
    });

    // En cambio sí vale para una corrección más suave: ambos verían "dispersas".
    const intermedia = obs({ distanciaKm: 35, insoMin: 30, fraccion: 0.5 });
    expect(decidirCorreccionCielo(despejado(), [intermedia, casiDespejado], ctx())).toMatchObject({
      aplicar: true,
      nivel: 'dispersas',
    });
  });

  it('un segundo testigo viejo tampoco corrobora', () => {
    const lejos = obs({ distanciaKm: 35 });
    const viejo = obs({ idema: '1109X', distanciaKm: 38, observadoEn: AHORA - 5 * 60 * 60 * 1000 });
    expect(decidirCorreccionCielo(despejado(), [lejos, viejo], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'sin-segundo-testigo',
    });
  });

  it('no corrige con sol suficiente ni "mejora" un cielo nublado', () => {
    const conSol = obs({ insoMin: 55, fraccion: 55 / 60 });
    expect(decidirCorreccionCielo(despejado(), [conSol], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'sol-suficiente',
    });
    // El modelo dice cubierto y hay sol: seguimos sin tocar. La corrección es de
    // un solo sentido a propósito.
    const cubierto = despejado({ icon: '04d', description: 'muy nuboso' });
    expect(decidirCorreccionCielo(cubierto, [conSol], ctx()).aplicar).toBe(false);
  });

  it('no corrige si el modelo ya dice algo igual o más nublado', () => {
    const cubierto = despejado({ icon: '04d', description: 'muy nuboso' });
    expect(decidirCorreccionCielo(cubierto, [obs()], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'modelo-ya-nublado',
    });

    // 03d (dispersas) con sol intermitente: el destino sería el mismo, no se toca.
    const dispersas = despejado({ icon: '03d', description: 'nubes dispersas' });
    expect(
      decidirCorreccionCielo(dispersas, [obs({ insoMin: 30, fraccion: 0.5 })], ctx()).aplicar,
    ).toBe(false);
  });

  it('sí degrada de 02d a muy nuboso: es a peor', () => {
    const algoDeNubes = despejado({ icon: '02d', description: 'algo de nubes' });
    expect(decidirCorreccionCielo(algoDeNubes, [obs()], ctx()).aplicar).toBe(true);
  });

  it('no corrige un icono de fenómeno que no está en la escala de nubosidad', () => {
    // Niebla: no se pisa con un icono de nubes aunque no haya sol.
    const niebla = despejado({ icon: '50d', description: 'niebla', conditionCode: 741 });
    expect(decidirCorreccionCielo(niebla, [obs()], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'modelo-ya-nublado',
    });
  });

  it('sin weather no hay nada que decidir', () => {
    expect(decidirCorreccionCielo(null, [obs()], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'sin-weather',
    });
  });
});

describe('aplicarCorreccionCielo', () => {
  it('conserva source OpenWeather: si no, el ranking pierde el texto del cielo', () => {
    // buildRankingReason (BeachScorer) solo usa la descripción cuando el origen
    // es OpenWeather. Cambiarlo aquí dejaría la razón sin la parte del cielo.
    const w = despejado();
    const d = decidirCorreccionCielo(w, [obs()], ctx());
    expect(aplicarCorreccionCielo(w, d).source).toBe('OpenWeather');
  });

  it('cambia solo cielo e icono y no toca el resto', () => {
    const w = despejado();
    const corregido = aplicarCorreccionCielo(w, decidirCorreccionCielo(w, [obs()], ctx()));

    expect(corregido.description).toBe('muy nuboso');
    expect(corregido.icon).toBe('04d');
    expect(corregido.temperatureC).toBe(w.temperatureC);
    expect(corregido.windSpeedMs).toBe(w.windSpeedMs);
    expect(corregido.humidityPct).toBe(w.humidityPct);
    expect(corregido.pressureHPa).toBe(w.pressureHPa);
    expect(corregido.timestamp).toBe(w.timestamp);
  });

  it('devuelve el original intacto cuando la decisión es no corregir', () => {
    const w = despejado();
    const d = decidirCorreccionCielo(w, [], ctx());
    expect(aplicarCorreccionCielo(w, d)).toBe(w);
  });

  it('los textos que emite son los que el frontend ya sabe traducir y dibujar', () => {
    // 'muy nuboso' y 'nubes dispersas' ya están en MAPA_CIELO y en emojiCielo,
    // así que el corrector no obliga a tocar el frontend.
    const w = despejado();
    const muyNuboso = aplicarCorreccionCielo(w, decidirCorreccionCielo(w, [obs()], ctx()));
    const dispersas = aplicarCorreccionCielo(
      w,
      decidirCorreccionCielo(w, [obs({ insoMin: 30, fraccion: 0.5 })], ctx()),
    );
    expect([muyNuboso.description, dispersas.description]).toEqual([
      'muy nuboso',
      'nubes dispersas',
    ]);
    expect([muyNuboso.icon, dispersas.icon]).toEqual(['04d', '03d']);
  });
});

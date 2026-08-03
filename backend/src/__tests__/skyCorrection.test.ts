import { describe, it, expect } from 'vitest';
import {
  decidirCorreccionCielo,
  aplicarCorreccionCielo,
  ContextoCorreccion,
} from '../domain/services/skyCorrection';
import { Weather } from '../domain/entities/Weather';
import { SunshineObservation } from '../domain/entities/Sunshine';

const AHORA = Date.parse('2026-07-29T12:00:00.000Z');

/** Clear sky according to the model: the case that motivates all of this. */
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
    // 29-jul: OpenWeather reported clouds.all 0 while Santander measured 0 min of sunshine.
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
    // Without this guard, the hour containing sunrise would mark "cloudy" on a
    // flawless day, because the sun was below the horizon for part of that hour.
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
    // The cache stale window reaches 3 h; this guard is what prevents
    // marking "cloudy" with a data point from this morning.
    const vieja = obs({ observadoEn: AHORA - 3 * 60 * 60 * 1000 });
    expect(decidirCorreccionCielo(despejado(), [vieja], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'observacion-vieja',
    });
  });

  it('no corrige con una observación fechada claramente en el futuro', () => {
    const futura = obs({ observadoEn: AHORA + 30 * 60 * 1000 });
    expect(decidirCorreccionCielo(despejado(), [futura], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'observacion-futura',
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

  it('un segundo testigo que ve sol NO corrobora: lo contradice', () => {
    const lejos = obs({ distanciaKm: 35 });
    const soleado = obs({ idema: '1109X', distanciaKm: 38, insoMin: 60, fraccion: 1 });
    // Sigue sin corregir, que es lo que importa. El motivo es ahora más
    // preciso: no es que nadie corroborase, es que un testigo dice justo lo
    // contrario — cero sol frente a la hora entera.
    expect(decidirCorreccionCielo(despejado(), [lejos, soleado], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'sin-consenso',
    });
  });

  it('el testigo debe ver AL MENOS tanta nube como la estación principal', () => {
    // 44 out of 60 minutes of sunshine does not confirm a "muy nuboso": it is almost clear.
    // With the previous lax rule it would have been enough that it was not fully
    // sunny, which is exactly the opposite of corroborating.
    const sinSol = obs({ distanciaKm: 35, insoMin: 0, fraccion: 0 });
    const casiDespejado = obs({ idema: '1109X', distanciaKm: 38, insoMin: 44, fraccion: 44 / 60 });
    expect(decidirCorreccionCielo(despejado(), [sinSol, casiDespejado], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'sin-segundo-testigo',
    });

    // It is however valid for a milder correction: both would see "dispersas".
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

  it('mantiene el modelo despejado cuando la insolación lo confirma', () => {
    const conSol = obs({ insoMin: 55, fraccion: 55 / 60 });
    expect(decidirCorreccionCielo(despejado(), [conSol], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'sol-suficiente',
    });
  });

  it('mejora un cielo nublado cuando una estación cercana registra sol sostenido', () => {
    const conSol = obs({ insoMin: 55, fraccion: 55 / 60, distanciaKm: 20 });
    const cubierto = despejado({ icon: '04d', description: 'muy nuboso' });
    expect(decidirCorreccionCielo(cubierto, [conSol], ctx({ nubesInmediatasPct: 0 }))).toMatchObject({
      aplicar: true,
      nivel: 'despejado',
    });
  });

  it('mejora con sol moderado si la próxima hora local también viene despejada', () => {
    const cubierto = despejado({ icon: '04d', description: 'muy nuboso' });
    const conSolModerado = obs({ insoMin: 33, fraccion: 0.55, distanciaKm: 17 });
    expect(
      decidirCorreccionCielo(
        cubierto,
        [conSolModerado],
        ctx({ nubesInmediatasPct: 0 }),
      ),
    ).toMatchObject({ aplicar: true, nivel: 'despejado' });
  });

  it('no mejora con sol moderado si la previsión inmediata no está despejada', () => {
    const cubierto = despejado({ icon: '04d', description: 'muy nuboso' });
    const conSolModerado = obs({ insoMin: 33, fraccion: 0.55, distanciaKm: 17 });
    expect(
      decidirCorreccionCielo(
        cubierto,
        [conSolModerado],
        ctx({ nubesInmediatasPct: 40 }),
      ),
    ).toMatchObject({ aplicar: false, motivo: 'modelo-ya-nublado' });
  });

  it('no mejora con insolación ambigua ni con una estación lejana', () => {
    const cubierto = despejado({ icon: '04d', description: 'muy nuboso' });
    expect(
      decidirCorreccionCielo(
        cubierto,
        [obs({ insoMin: 48, fraccion: 0.8, distanciaKm: 10 })],
        ctx(),
      ),
    ).toMatchObject({ aplicar: false, motivo: 'sol-suficiente' });

    expect(
      decidirCorreccionCielo(
        cubierto,
        [obs({ insoMin: 55, fraccion: 55 / 60, distanciaKm: 26 })],
        ctx({ nubesInmediatasPct: 0, horasDespejadasConsecutivas: 2 }),
      ),
    ).toMatchObject({ aplicar: false, motivo: 'estacion-lejos-para-mejorar' });
  });

  it('un segundo testigo a más de 40 km tampoco corrobora', () => {
    const lejos = obs({ distanciaKm: 35 });
    const fueraDeRadio = obs({ idema: '1109X', distanciaKm: 48 });
    expect(decidirCorreccionCielo(despejado(), [lejos, fueraDeRadio], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'sin-segundo-testigo',
    });
  });

  it('mejora entre 25 y 40 km solo con sol fuerte y tres horas despejadas', () => {
    const cubierto = despejado({ icon: '04d', description: 'muy nuboso' });
    const lejanaSoleada = obs({ insoMin: 58, fraccion: 0.97, distanciaKm: 32 });
    expect(
      decidirCorreccionCielo(
        cubierto,
        [lejanaSoleada],
        ctx({ nubesInmediatasPct: 0, horasDespejadasConsecutivas: 3 }),
      ),
    ).toMatchObject({ aplicar: true, nivel: 'despejado' });

    const solModerado = obs({ insoMin: 33, fraccion: 0.55, distanciaKm: 32 });
    expect(
      decidirCorreccionCielo(
        cubierto,
        [solModerado],
        ctx({ nubesInmediatasPct: 0, horasDespejadasConsecutivas: 4 }),
      ),
    ).toMatchObject({ aplicar: false, motivo: 'estacion-lejos-para-mejorar' });
  });

  it('entre 40 y 50 km usa sol casi total y corroboración local inmediata', () => {
    const cubierto = despejado({ icon: '04d', description: 'muy nuboso' });
    const decision = (distanciaKm: number, fraccion: number, nubes = 0) => decidirCorreccionCielo(
      cubierto,
      [obs({ insoMin: Math.round(fraccion * 60), fraccion, distanciaKm })],
      ctx({ nubesInmediatasPct: nubes, horasDespejadasConsecutivas: 1 }),
    );

    expect(decision(40, 0.97)).toMatchObject({ aplicar: true, nivel: 'despejado' });
    expect(decision(41, 0.97)).toMatchObject({ aplicar: true, nivel: 'despejado' });
    expect(decision(50, 0.95)).toMatchObject({ aplicar: true, nivel: 'despejado' });
    expect(decision(41, 0.94)).toMatchObject({
      aplicar: false,
      motivo: 'estacion-lejos-para-mejorar',
    });
    expect(decision(41, 0.97, 11)).toMatchObject({ aplicar: false, motivo: 'sol-suficiente' });
    expect(decision(51, 0.97)).toMatchObject({ aplicar: false, motivo: 'estacion-lejos' });
  });

  it('no corrige si el modelo ya dice algo igual o más nublado', () => {
    const cubierto = despejado({ icon: '04d', description: 'muy nuboso' });
    expect(decidirCorreccionCielo(cubierto, [obs()], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'modelo-ya-nublado',
    });

    // 03d (dispersas) with intermittent sunshine: the target would be the same, left untouched.
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
    // Fog: it is not overwritten with a clouds icon even if there is no sunshine.
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
    // buildRankingReason (BeachScorer) only uses the description when the source
    // is OpenWeather. Changing it here would leave the reason without the sky part.
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

  it('aplica la mejora a despejado sin tocar el resto del dato meteorológico', () => {
    const w = despejado({ icon: '04d', description: 'muy nuboso', cloudinessPct: 90 });
    const conSol = obs({ insoMin: 55, fraccion: 55 / 60, distanciaKm: 20 });
    const corregido = aplicarCorreccionCielo(
      w,
      decidirCorreccionCielo(w, [conSol], ctx({ nubesInmediatasPct: 0 })),
    );

    expect(corregido.description).toBe('cielo claro');
    expect(corregido.icon).toBe('01d');
    expect(corregido.temperatureC).toBe(w.temperatureC);
    expect(corregido.windSpeedMs).toBe(w.windSpeedMs);
    expect(corregido.timestamp).toBe(w.timestamp);
  });

  it('los textos que emite son los que el frontend ya sabe traducir y dibujar', () => {
    // 'muy nuboso' and 'nubes dispersas' are already in MAPA_CIELO and in emojiCielo,
    // so the corrector does not force touching the frontend.
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

/**
 * Consensus between stations.
 *
 * Real case, 3-aug-2026: the only two sunshine stations within 50 km of the
 * Cantabrian coast are 7 km apart and reported, in the same hour, 0 and 54.2
 * minutes of sun. As the nearest one decided alone below 30 km, the verdict
 * was handed out by geometry — 36 of the 46 beaches were corrected on the word
 * of a station its own neighbour flatly denied.
 */
describe('decidirCorreccionCielo — consenso entre estaciones', () => {
  /** 1109X Santander Aeropuerto: cero sol. */
  const parayas = obs({ idema: '1109X', distanciaKm: 17.1, insoMin: 0, fraccion: 0 });
  /** 1111X Santander CMT, a 7 km de la anterior: la hora casi entera de sol. */
  const cmt = obs({ idema: '1111X', distanciaKm: 20.5, insoMin: 54.2, fraccion: 54.2 / 60 });

  it('no corrige cuando la estación que decide está contradicha por otra cercana', () => {
    expect(decidirCorreccionCielo(despejado(), [parayas, cmt], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'sin-consenso',
      idema: '1109X',
    });
  });

  it('la contradicción cuenta en las dos direcciones', () => {
    // Ahora decide la soleada; la que ve cero sol la contradice igual.
    const nublado = despejado({ description: 'muy nuboso', icon: '04d', conditionCode: 804 });
    expect(decidirCorreccionCielo(nublado, [cmt, parayas], ctx())).toMatchObject({
      aplicar: false,
      motivo: 'sin-consenso',
      idema: '1111X',
    });
  });

  it('sola, sin nadie que la contradiga, la estación cercana sigue decidiendo', () => {
    // Es el comportamiento de siempre: por debajo de 30 km no hace falta testigo.
    expect(decidirCorreccionCielo(despejado(), [parayas], ctx()).aplicar).toBe(true);
  });

  it('NO desarma el caso que motivó el corrector: si todas ven cero sol, corrige', () => {
    // 29-jul: estratos marinos sobre toda la costa, las dos estaciones de
    // acuerdo. El guardia solo frena cuando los testigos se pelean.
    const tambienSinSol = obs({ idema: '1111X', distanciaKm: 20.5, insoMin: 2, fraccion: 2 / 60 });
    expect(decidirCorreccionCielo(despejado(), [parayas, tambienSinSol], ctx()).aplicar).toBe(true);
  });

  it('una diferencia dentro de la banda dudosa no es contradicción', () => {
    // 0.20 y 0.40 caen a ambos lados de un umbral, pero eso es ruido de sensor,
    // no dos cielos distintos: la banda intermedia ya está declarada dudosa.
    const floja = obs({ idema: '1109X', distanciaKm: 17.1, insoMin: 12, fraccion: 0.2 });
    const media = obs({ idema: '1111X', distanciaKm: 20.5, insoMin: 24, fraccion: 0.4 });
    expect(decidirCorreccionCielo(despejado(), [floja, media], ctx()).aplicar).toBe(true);
  });

  it('un testigo demasiado lejos o rancio no invalida la decisión', () => {
    const lejano = obs({ idema: '1183X', distanciaKm: 57, insoMin: 60, fraccion: 1 });
    expect(decidirCorreccionCielo(despejado(), [parayas, lejano], ctx()).aplicar).toBe(true);

    const rancio = obs({
      idema: '1111X',
      distanciaKm: 20.5,
      insoMin: 60,
      fraccion: 1,
      observadoEn: AHORA - 3 * 60 * 60 * 1000,
    });
    expect(decidirCorreccionCielo(despejado(), [parayas, rancio], ctx()).aplicar).toBe(true);
  });
});

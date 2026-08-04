import { describe, it, expect } from 'vitest';
import {
  computeSkyScore,
  computeTemperatureScore,
  computeFlagScore,
  computeWindScore,
  computeWavesScore,
  computeDataScore,
  computeBeachScore,
  buildRankingReason,
  buildCautionReason,
  SubScores,
  buildDowngradeFactors,
  isExcluded,
  ForecastEnrichment,
  RAIN_SCORE_CAP,
  RAIN_FORECAST_SCORE_CAP,
} from '../domain/use-cases/BeachScorer';
import { Weather } from '../domain/entities/Weather';
import { FlagStatus } from '../domain/entities/Flag';
import { RainNowcast } from '../domain/entities/RainNowcast';
import { RainForecastSignal } from '../domain/use-cases/RainForecast';
import { OutlookSignal } from '../domain/use-cases/WeatherOutlook';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWeather(overrides: Partial<Weather> = {}): Weather {
  return {
    source: 'OpenWeather',
    timestamp: Date.now(),
    temperatureC: 22,
    description: 'clear sky',
    icon: '01d',
    windSpeedMs: 2,
    windDirectionDeg: 180,
    humidityPct: 50,
    pressureHPa: 1013,
    ...overrides,
  };
}

function makeFlag(overrides: Partial<FlagStatus> = {}): FlagStatus {
  return {
    color: 'green',
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeEnrichment(overrides: Partial<ForecastEnrichment> = {}): ForecastEnrichment {
  return {
    waves: null,
    uvIndex: null,
    warningLevel: null,
    ...overrides,
  };
}

function makeRain(overrides: Partial<RainNowcast> = {}): RainNowcast {
  return {
    status: 'raining',
    precipitationMm: 0.4,
    lastHourOnly: false,
    sources: [],
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeForecastSignal(overrides: Partial<RainForecastSignal> = {}): RainForecastSignal {
  return {
    expected: true,
    firstAt: Date.now() + 3600_000,
    mmMax: 0.5,
    sources: ['OpenMeteo'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Sky score
// ---------------------------------------------------------------------------

describe('computeSkyScore', () => {
  it('returns max for clear sky icon', () => {
    expect(computeSkyScore(makeWeather({ icon: '01d' }))).toBe(25);
    expect(computeSkyScore(makeWeather({ icon: '01n' }))).toBe(25);
  });

  it('returns lower for cloudy icons', () => {
    expect(computeSkyScore(makeWeather({ icon: '04d' }))).toBe(10);
  });

  it('returns 0 for rain/storm', () => {
    expect(computeSkyScore(makeWeather({ icon: '10d' }))).toBe(0);
    expect(computeSkyScore(makeWeather({ icon: '11d' }))).toBe(0);
  });

  it('falls back to description when icon is null', () => {
    expect(computeSkyScore(makeWeather({ icon: null, description: 'Despejado' }))).toBe(25);
    expect(computeSkyScore(makeWeather({ icon: null, description: 'Nublado' }))).toBe(10);
    expect(computeSkyScore(makeWeather({ icon: null, description: 'Lluvia' }))).toBe(0);
  });

  it('returns neutral when null weather', () => {
    expect(computeSkyScore(null)).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Temperature score
// ---------------------------------------------------------------------------

describe('computeTemperatureScore', () => {
  it('returns 0 for very cold', () => {
    expect(computeTemperatureScore(5)).toBe(0);
  });

  it('22° es una muy buena temperatura de playa, no un aprobado raspado', () => {
    // Regresión de producto: con el reparto viejo (max 20) sacaba 14, un 70%
    // para el día que cualquiera describiría como bueno. Ahora 22/25 = 88%.
    expect(computeTemperatureScore(22)).toBe(22);
    expect(computeTemperatureScore(22) / 25).toBeGreaterThan(0.85);
  });

  it('returns max for optimal range', () => {
    expect(computeTemperatureScore(26)).toBe(24);
    expect(computeTemperatureScore(30)).toBe(25);
  });

  it('returns neutral for null', () => {
    expect(computeTemperatureScore(null)).toBe(9);
  });

  it('penalizes extreme heat', () => {
    const score30 = computeTemperatureScore(30);
    const score38 = computeTemperatureScore(38);
    expect(score30).toBe(25);
    expect(score38).toBeLessThan(score30);
  });

  it('scores increase from cold to warm', () => {
    expect(computeTemperatureScore(10)).toBeLessThan(computeTemperatureScore(15));
    expect(computeTemperatureScore(15)).toBeLessThan(computeTemperatureScore(20));
    expect(computeTemperatureScore(20)).toBeLessThan(computeTemperatureScore(25));
  });
});

// ---------------------------------------------------------------------------
// Flag score
// ---------------------------------------------------------------------------

describe('computeFlagScore', () => {
  it('returns max for green', () => {
    expect(computeFlagScore(makeFlag({ color: 'green' }))).toBe(20);
  });

  it('returns 10 for yellow', () => {
    expect(computeFlagScore(makeFlag({ color: 'yellow' }))).toBe(10);
  });

  it('returns 0 for red and black', () => {
    expect(computeFlagScore(makeFlag({ color: 'red' }))).toBe(0);
    expect(computeFlagScore(makeFlag({ color: 'black' }))).toBe(0);
  });

  it('returns neutral for null (no Cruz Roja coverage)', () => {
    expect(computeFlagScore(null)).toBe(10);
  });

  it('una bandera que no podemos leer puntúa igual que no tener servicio', () => {
    // "Hay bandera, lo que no tenemos es información": restar por eso castigaba
    // a la playa por un fallo nuestro, y encima MÁS que a una playa sin
    // vigilancia, que se llevaba el 10 neutro.
    expect(computeFlagScore(makeFlag({ color: 'unknown' }))).toBe(10);
    expect(computeFlagScore(makeFlag({ color: 'unknown' }))).toBe(computeFlagScore(null));
  });
});

// ---------------------------------------------------------------------------
// Wind score
// ---------------------------------------------------------------------------

describe('computeWindScore', () => {
  it('returns max for calm', () => {
    expect(computeWindScore(0)).toBe(15);
    expect(computeWindScore(2)).toBe(15);
  });

  it('decreases with stronger wind', () => {
    expect(computeWindScore(3)).toBeGreaterThan(computeWindScore(8));
    expect(computeWindScore(8)).toBeGreaterThan(computeWindScore(15));
  });

  it('returns 0 for very strong wind', () => {
    expect(computeWindScore(20)).toBe(0);
  });

  it('returns neutral for null', () => {
    expect(computeWindScore(null)).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Waves score
// ---------------------------------------------------------------------------

describe('computeWavesScore', () => {
  it('returns max for calm waves text', () => {
    expect(computeWavesScore(makeEnrichment({ waves: 'débil' }), null, false)).toBe(10);
    expect(computeWavesScore(makeEnrichment({ waves: 'tranquilo' }), null, false)).toBe(10);
  });

  it('returns lower for strong waves', () => {
    expect(computeWavesScore(makeEnrichment({ waves: 'fuerte' }), null, false)).toBe(2);
  });

  it('derives from wind when no enrichment', () => {
    // wind 2 m/s → "tranquilo" → 10
    expect(computeWavesScore(null, makeWeather({ windSpeedMs: 2 }), false)).toBe(10);
    // wind 8 m/s → 28.8 km/h → "agitado" → 2
    expect(computeWavesScore(null, makeWeather({ windSpeedMs: 8 }), false)).toBe(2);
  });

  it('does not penalize surf beaches for moderate/strong waves', () => {
    const scoreNonSurf = computeWavesScore(makeEnrichment({ waves: 'fuerte' }), null, false);
    const scoreSurf = computeWavesScore(makeEnrichment({ waves: 'fuerte' }), null, true);
    expect(scoreSurf).toBeGreaterThan(scoreNonSurf);
    expect(scoreSurf).toBeGreaterThanOrEqual(7);
  });

  it('returns neutral when no data at all', () => {
    expect(computeWavesScore(null, null, false)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Data completeness score
// ---------------------------------------------------------------------------

describe('computeDataScore', () => {
  it('returns 5 when both weather and flag available', () => {
    expect(computeDataScore(makeWeather(), makeFlag())).toBe(5);
  });

  it('returns 3 with only weather', () => {
    expect(computeDataScore(makeWeather(), null)).toBe(3);
  });

  it('returns 2 with only flag', () => {
    expect(computeDataScore(null, makeFlag())).toBe(2);
  });

  it('returns 0 with no data', () => {
    expect(computeDataScore(null, null)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Exclusion rules
// ---------------------------------------------------------------------------

describe('isExcluded', () => {
  it('excludes black flag', () => {
    expect(isExcluded(null, makeFlag({ color: 'black' }), null)).toBe(true);
  });

  it('excludes red flag + strong wind', () => {
    expect(isExcluded(
      makeWeather({ windSpeedMs: 15 }),
      makeFlag({ color: 'red' }),
      null,
    )).toBe(true);
  });

  it('does NOT exclude red flag alone (no wind data)', () => {
    expect(isExcluded(null, makeFlag({ color: 'red' }), null)).toBe(false);
  });

  it('excludes thunderstorm', () => {
    expect(isExcluded(makeWeather({ icon: '11d' }), null, null)).toBe(true);
    expect(isExcluded(makeWeather({ icon: '11n' }), null, null)).toBe(true);
  });

  it('excludes weather warning level >= 2', () => {
    expect(isExcluded(null, null, makeEnrichment({ warningLevel: 2 }))).toBe(true);
    expect(isExcluded(null, null, makeEnrichment({ warningLevel: 3 }))).toBe(true);
  });

  it('does NOT exclude warning level 1', () => {
    expect(isExcluded(null, null, makeEnrichment({ warningLevel: 1 }))).toBe(false);
  });

  it('does NOT exclude good conditions', () => {
    expect(isExcluded(
      makeWeather({ icon: '01d', windSpeedMs: 2 }),
      makeFlag({ color: 'green' }),
      null,
    )).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Full scoring
// ---------------------------------------------------------------------------

describe('computeBeachScore', () => {
  it('returns high score for ideal conditions', () => {
    const weather = makeWeather({ icon: '01d', temperatureC: 25, windSpeedMs: 2 });
    const flag = makeFlag({ color: 'green' });
    const enrichment = makeEnrichment({ waves: 'tranquilo', uvIndex: 4 });

    const { score } = computeBeachScore(weather, flag, enrichment);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('returns low score for bad conditions', () => {
    const weather = makeWeather({ icon: '10d', temperatureC: 8, windSpeedMs: 15 });
    const flag = makeFlag({ color: 'red' });
    const enrichment = makeEnrichment({ waves: 'muy fuerte', uvIndex: 9 });

    const { score } = computeBeachScore(weather, flag, enrichment);
    expect(score).toBeLessThan(20);
  });

  it('returns moderate neutral score when no data', () => {
    const { score } = computeBeachScore(null, null, null);
    // All neutral values: 8+9+10+7+5+0 = 39 (UV ya no puntúa)
    expect(score).toBe(39);
  });

  it('score with no data is below score with good data', () => {
    const goodScore = computeBeachScore(
      makeWeather({ icon: '01d', temperatureC: 24, windSpeedMs: 2 }),
      makeFlag({ color: 'green' }),
      makeEnrichment({ waves: 'tranquilo', uvIndex: 3 }),
    ).score;

    const noDataScore = computeBeachScore(null, null, null).score;
    expect(goodScore).toBeGreaterThan(noDataScore);
  });

  it('surf beach not penalized for strong waves', () => {
    const weather = makeWeather({ icon: '01d', temperatureC: 22, windSpeedMs: 3 });
    const flag = makeFlag({ color: 'green' });
    const enrichment = makeEnrichment({ waves: 'fuerte', uvIndex: 4 });

    const nonSurf = computeBeachScore(weather, flag, enrichment);
    const surf = computeBeachScore(weather, flag, enrichment, { surf: true });

    expect(surf.score).toBeGreaterThan(nonSurf.score);
  });
});

// ---------------------------------------------------------------------------
// Ranking reason
// ---------------------------------------------------------------------------

describe('buildRankingReason', () => {
  it('includes Sol for clear sky', () => {
    const weather = makeWeather({ icon: '01d', temperatureC: 22, windSpeedMs: 2 });
    const { subScores } = computeBeachScore(weather, makeFlag({ color: 'green' }), null);
    const reason = buildRankingReason(subScores, weather, makeFlag({ color: 'green' }));
    expect(reason).toContain('Sol');
    expect(reason).toContain('22\u00B0');
    expect(reason).toContain('bandera verde');
  });

  it('returns fallback for poor conditions', () => {
    const reason = buildRankingReason(
      { cielo: 5, temperatura: 5, bandera: 0, viento: 3, oleaje: 5, datos: 0 },
      null,
      null,
    );
    expect(reason).toBe('Condiciones aceptables');
  });

  it('includes precaucion for yellow flag', () => {
    const weather = makeWeather({ temperatureC: 20 });
    const flag = makeFlag({ color: 'yellow' });
    const { subScores } = computeBeachScore(weather, flag, null);
    const reason = buildRankingReason(subScores, weather, flag);
    expect(reason).toContain('precauci\u00F3n');
  });
});

// ---------------------------------------------------------------------------
// Rain detected now (RainNowcast) → yellow cap + reasons
// ---------------------------------------------------------------------------

describe('computeBeachScore con lluvia detectada (RainNowcast)', () => {
  const perfect = () => ({
    weather: makeWeather({ icon: '01d', temperatureC: 25, windSpeedMs: 2 }),
    flag: makeFlag({ color: 'green' }),
    enrichment: makeEnrichment({ waves: 'débil', uvIndex: 4 }),
  });

  it('capa la puntuación a RAIN_SCORE_CAP (tramo amarillo: <60 y ≥35)', () => {
    const { weather, flag, enrichment } = perfect();
    const sinLluvia = computeBeachScore(weather, flag, enrichment);
    const conLluvia = computeBeachScore(weather, flag, enrichment, undefined, makeRain());

    expect(sinLluvia.score).toBeGreaterThan(60);
    expect(conLluvia.score).toBe(RAIN_SCORE_CAP);
    expect(conLluvia.score).toBeLessThan(60);
    expect(conLluvia.score).toBeGreaterThanOrEqual(35);
  });

  it('no toca la puntuación si la señal es dry/unknown o no llega (regresión)', () => {
    const { weather, flag, enrichment } = perfect();
    const base = computeBeachScore(weather, flag, enrichment);

    expect(computeBeachScore(weather, flag, enrichment, undefined, makeRain({ status: 'dry' })).score).toBe(base.score);
    expect(computeBeachScore(weather, flag, enrichment, undefined, makeRain({ status: 'unknown' })).score).toBe(base.score);
    expect(computeBeachScore(weather, flag, enrichment, undefined, null).score).toBe(base.score);
  });

  it('no sube puntuaciones que ya estaban por debajo del tope', () => {
    const badWeather = makeWeather({ icon: '10d', temperatureC: 12, windSpeedMs: 14 });
    const sin = computeBeachScore(badWeather, null, null);
    const con = computeBeachScore(badWeather, null, null, undefined, makeRain());
    expect(con.score).toBe(sin.score);
  });
});

describe('razones con lluvia detectada', () => {
  it('buildRankingReason antepone "Lloviendo ahora" aunque el cielo diga nuboso', () => {
    const weather = makeWeather({ description: 'muy nuboso', icon: '04d' });
    const { subScores } = computeBeachScore(weather, null, null);
    const reason = buildRankingReason(subScores, weather, null, null, makeRain());
    expect(reason).toMatch(/^Lloviendo ahora/);
  });

  it('buildRankingReason distingue la señal retardada del pluviómetro', () => {
    const weather = makeWeather({ description: 'muy nuboso', icon: '04d' });
    const { subScores } = computeBeachScore(weather, null, null);
    const reason = buildRankingReason(subScores, weather, null, null, makeRain({ lastHourOnly: true }));
    expect(reason).toMatch(/^Lluvia en la última hora/);
  });

  it('buildDowngradeFactors menciona la lluvia sin duplicar el factor de cielo', () => {
    const weather = makeWeather({ description: 'muy nuboso', icon: '04d', temperatureC: 25 });
    const { subScores } = computeBeachScore(weather, makeFlag({ color: 'green' }), null);
    const factors = buildDowngradeFactors(subScores, makeFlag({ color: 'green' }), makeRain());
    expect(factors).toMatch(/^Lloviendo ahora/);
    expect(factors).not.toContain('cielo nublado');
  });

  it('buildCautionReason incluye la lluvia y no duplica "lluvia o tormenta"', () => {
    const weather = makeWeather({ icon: '10d', temperatureC: 12 });
    const { subScores } = computeBeachScore(weather, null, null);
    const reason = buildCautionReason(subScores, weather, null, null, makeRain());
    expect(reason.toLowerCase()).toContain('lloviendo ahora');
    expect(reason).not.toContain('lluvia o tormenta');
  });

  it('las razones no cambian sin señal de lluvia (regresión)', () => {
    const weather = makeWeather({ icon: '01d', temperatureC: 22, windSpeedMs: 2 });
    const { subScores } = computeBeachScore(weather, makeFlag({ color: 'green' }), null);
    const reason = buildRankingReason(subScores, weather, makeFlag({ color: 'green' }));
    expect(reason).toContain('Sol');
  });
});

// ---------------------------------------------------------------------------
// FORECAST rain (RainForecastSignal) → soft yellow cap 59 + reasons
// ---------------------------------------------------------------------------

describe('computeBeachScore con lluvia prevista', () => {
  const perfect = () => ({
    weather: makeWeather({ icon: '01d', temperatureC: 25, windSpeedMs: 2 }),
    flag: makeFlag({ color: 'green' }),
    enrichment: makeEnrichment({ waves: 'débil', uvIndex: 4 }),
  });

  it('capa a RAIN_FORECAST_SCORE_CAP (59): amarillo suave, por encima del 55 de lluvia activa', () => {
    const { weather, flag, enrichment } = perfect();
    const r = computeBeachScore(weather, flag, enrichment, undefined, null, makeForecastSignal());
    expect(r.score).toBe(RAIN_FORECAST_SCORE_CAP);
    expect(r.score).toBeLessThan(60);
    expect(r.score).toBeGreaterThan(RAIN_SCORE_CAP);
  });

  it('la lluvia ACTIVA gana a la prevista (55 < 59)', () => {
    const { weather, flag, enrichment } = perfect();
    const r = computeBeachScore(weather, flag, enrichment, undefined, makeRain(), makeForecastSignal());
    expect(r.score).toBe(RAIN_SCORE_CAP);
  });

  it('sin señal o con expected=false no cambia nada (regresión)', () => {
    const { weather, flag, enrichment } = perfect();
    const base = computeBeachScore(weather, flag, enrichment);
    expect(
      computeBeachScore(weather, flag, enrichment, undefined, null, makeForecastSignal({ expected: false })).score
    ).toBe(base.score);
    expect(computeBeachScore(weather, flag, enrichment, undefined, null, null).score).toBe(base.score);
  });
});

describe('razones con lluvia prevista', () => {
  it('buildRankingReason añade "lluvia prevista" manteniendo el cielo al frente', () => {
    const weather = makeWeather({ icon: '01d', description: 'cielo claro', temperatureC: 25, windSpeedMs: 2 });
    const { subScores } = computeBeachScore(weather, makeFlag({ color: 'green' }), null);
    const reason = buildRankingReason(subScores, weather, makeFlag({ color: 'green' }), null, null, makeForecastSignal());
    expect(reason).toMatch(/^Sol/);
    expect(reason).toContain('lluvia prevista');
  });

  it('la lluvia ACTIVA suprime el fragmento de prevista (nunca ambos)', () => {
    const weather = makeWeather({ description: 'muy nuboso', icon: '04d' });
    const { subScores } = computeBeachScore(weather, null, null);
    const reason = buildRankingReason(subScores, weather, null, null, makeRain(), makeForecastSignal());
    expect(reason).toMatch(/^Lloviendo ahora/);
    expect(reason).not.toContain('lluvia prevista');
  });

  it('si el cielo ya dice Lluvia, no duplica con "lluvia prevista"', () => {
    const weather = makeWeather({ description: 'lluvia ligera', icon: null });
    const { subScores } = computeBeachScore(weather, null, null);
    const reason = buildRankingReason(subScores, weather, null, null, null, makeForecastSignal());
    expect(reason).toMatch(/^Lluvia/);
    expect(reason).not.toContain('lluvia prevista');
  });

  it('buildDowngradeFactors antepone "Lluvia prevista" sin duplicar el factor de cielo', () => {
    const weather = makeWeather({ description: 'muy nuboso', icon: '04d', temperatureC: 25 });
    const { subScores } = computeBeachScore(weather, makeFlag({ color: 'green' }), null);
    const factors = buildDowngradeFactors(subScores, makeFlag({ color: 'green' }), null, makeForecastSignal());
    expect(factors).toMatch(/^Lluvia prevista/);
    expect(factors).not.toContain('cielo nublado');
  });

  it('buildCautionReason incluye "lluvia prevista" y no duplica "lluvia o tormenta"', () => {
    const weather = makeWeather({ icon: '10d', temperatureC: 12 });
    const { subScores } = computeBeachScore(weather, null, null);
    const reason = buildCautionReason(subScores, weather, null, null, null, makeForecastSignal());
    expect(reason.toLowerCase()).toContain('lluvia prevista');
    expect(reason).not.toContain('lluvia o tormenta');
  });
});

// ---------------------------------------------------------------------------
// Region with no flag operator (phase 3)
// ---------------------------------------------------------------------------

/** A region that declares no flag operator at all. */
const SIN_OPERADOR: readonly string[] = [];

describe('región sin servicio de banderas', () => {
  // Every non-flag factor at its maximum, so the totals below are exact.
  // 30° es donde la curva de temperatura llega a su tope (25/25).
  const buenTiempo = () =>
    makeWeather({ icon: '01d', temperatureC: 30, windSpeedMs: 2 });

  it('deja el factor bandera fuera de la puntuación', () => {
    const { subScores } = computeBeachScore(
      buenTiempo(), null, null, undefined, null, null, SIN_OPERADOR,
    );
    expect(subScores.bandera).toBe(0);
  });

  it('no hunde la nota: un día perfecto sigue llegando a 100', () => {
    const enrichment = makeEnrichment({ waves: 'tranquilo', uvIndex: 3 });
    const { score } = computeBeachScore(
      buenTiempo(), null, enrichment, undefined, null, null, SIN_OPERADOR,
    );
    expect(score).toBe(100);
  });

  it('con operador, ese mismo día perfecto pierde puntos por no tener bandera', () => {
    const enrichment = makeEnrichment({ waves: 'tranquilo', uvIndex: 3 });
    const conOperador = computeBeachScore(buenTiempo(), null, enrichment).score;
    const sinOperador = computeBeachScore(
      buenTiempo(), null, enrichment, undefined, null, null, SIN_OPERADOR,
    ).score;
    // The 12 points it cannot reach (10 neutral flag + the 2 from "datos"
    // that need a reading) are the ones that used to cap a whole region.
    expect(conOperador).toBe(88);
    expect(sinOperador).toBe(100);
  });

  it('mantiene el orden relativo entre playas (solo cambia la escala)', () => {
    const mejor = buenTiempo();
    const peor = makeWeather({ icon: '04d', temperatureC: 16, windSpeedMs: 9 });
    const s = (w: Weather) =>
      computeBeachScore(w, null, null, undefined, null, null, SIN_OPERADOR).score;
    expect(s(mejor)).toBeGreaterThan(s(peor));
  });

  it('los topes de lluvia siguen siendo absolutos tras reescalar', () => {
    const { score } = computeBeachScore(
      buenTiempo(), null, null, undefined, makeRain(), null, SIN_OPERADOR,
    );
    expect(score).toBe(RAIN_SCORE_CAP);
  });

  it('no lista "sin cobertura" como motivo de bajada', () => {
    const weather = makeWeather({ icon: '04d', temperatureC: 16 });
    const { subScores } = computeBeachScore(
      weather, null, null, undefined, null, null, SIN_OPERADOR,
    );
    const factors = buildDowngradeFactors(subScores, null, null, null, SIN_OPERADOR);
    expect(factors ?? '').not.toContain('sin cobertura');
  });
});

describe('buildDowngradeFactors nombra al operador de la región', () => {
  it('usa el operador declarado en vez de una marca fija', () => {
    const weather = makeWeather({ icon: '04d', temperatureC: 16 });
    const { subScores } = computeBeachScore(weather, null, null);
    expect(buildDowngradeFactors(subScores, null, null, null, ['DYA']))
      .toContain('sin cobertura DYA');
  });

  it('mantiene el texto de Cantabria (contrato con el frontend desplegado)', () => {
    const weather = makeWeather({ icon: '04d', temperatureC: 16 });
    const { subScores } = computeBeachScore(weather, null, null);
    expect(buildDowngradeFactors(subScores, null, null, null, ['Cruz Roja']))
      .toContain('sin cobertura Cruz Roja');
  });

  it('calla sobre la cobertura cuando la playa SÍ tiene puesto y falta la lectura', () => {
    // Tagle, 2-ago-2026: el detalle daba bandera verde y el listado "sin
    // cobertura Cruz Roja" porque el scrape no había respondido a tiempo.
    const weather = makeWeather({ icon: '04d', temperatureC: 16 });
    const { subScores } = computeBeachScore(weather, null, null);
    const factors = buildDowngradeFactors(
      subScores, null, null, null, ['Cruz Roja'], null, true,
    );
    expect(factors ?? '').not.toContain('sin cobertura');
    // El resto de motivos sigue saliendo: callar no es enmudecer la línea.
    expect(factors).toContain('Cielo nublado');
  });
});

describe('invariantes de rango de computeBeachScore', () => {
  const perfecto = () => makeWeather({ icon: '01d', temperatureC: 30, windSpeedMs: 2 });
  const enriquecido = () => makeEnrichment({ waves: 'tranquilo', uvIndex: 3 });

  it('ignora la bandera cuando la región no declara operador', () => {
    // Reported by the audit: honouring the flag in `datos` while excluding it
    // from `bandera` was worth 2 points that the rescale turned into 103.
    const r = computeBeachScore(
      perfecto(), makeFlag({ color: 'green' }), enriquecido(), undefined, null, null, [],
    );
    expect(r.subScores.bandera).toBe(0);
    expect(r.subScores.datos).toBe(computeDataScore(perfecto(), null));
    expect(r.score).toBe(100);
  });

  it('nunca sale del rango 0-100, ni con entradas incoherentes', () => {
    const casos: Array<readonly string[]> = [[], ['Cruz Roja'], ['DYA', 'Cruz Roja']];
    for (const operadores of casos) {
      for (const flag of [null, makeFlag({ color: 'green' }), makeFlag({ color: 'red' })]) {
        for (const weather of [null, perfecto(), makeWeather({ icon: '10d', temperatureC: 5, windSpeedMs: 20 })]) {
          const { score } = computeBeachScore(
            weather, flag, enriquecido(), { surf: true }, null, null, operadores,
          );
          expect(score, `${operadores.length} operadores`).toBeGreaterThanOrEqual(0);
          expect(score, `${operadores.length} operadores`).toBeLessThanOrEqual(100);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Previsión de las próximas horas (WeatherOutlook)
// ---------------------------------------------------------------------------

describe('computeBeachScore con previsión de las próximas horas', () => {
  const nublada = () => ({
    weather: makeWeather({ icon: '04d', description: 'nubes', temperatureC: 20, windSpeedMs: 3 }),
    flag: null,
    enrichment: null,
  });

  const señal = (delta: number): OutlookSignal => ({
    delta,
    direccion: delta >= 3 ? 'mejora' : delta <= -3 ? 'empeora' : 'estable',
    horasConsideradas: 4,
    causa: delta === 0 ? null : delta > 0 ? 'despeja' : 'nubla',
  });

  it('suma cuando va a mejorar y resta cuando va a empeorar', () => {
    const { weather, flag, enrichment } = nublada();
    const base = computeBeachScore(weather, flag, enrichment).score;

    const mejor = computeBeachScore(weather, flag, enrichment, undefined, null, null, ['Cruz Roja'], señal(8));
    const peor = computeBeachScore(weather, flag, enrichment, undefined, null, null, ['Cruz Roja'], señal(-8));

    expect(mejor.score).toBe(base + 8);
    expect(peor.score).toBe(base - 8);
    expect(mejor.subScores.pronostico).toBe(8);
  });

  it('sin señal la nota es exactamente la de antes (regresión)', () => {
    const { weather, flag, enrichment } = nublada();
    const base = computeBeachScore(weather, flag, enrichment).score;

    expect(computeBeachScore(weather, flag, enrichment, undefined, null, null, ['Cruz Roja'], null).score).toBe(base);
    expect(computeBeachScore(weather, flag, enrichment, undefined, null, null, ['Cruz Roja'], señal(0)).score).toBe(base);
  });

  it('una mejora NO rompe el tope de lluvia activa: sigue lloviendo', () => {
    const weather = makeWeather({ icon: '01d', temperatureC: 25, windSpeedMs: 2 });
    const r = computeBeachScore(
      weather, makeFlag({ color: 'green' }), makeEnrichment({ waves: 'débil', uvIndex: 4 }),
      undefined, makeRain(), null, ['Cruz Roja'], señal(8),
    );

    expect(r.score).toBe(RAIN_SCORE_CAP);
  });

  it('un empeoramiento SÍ baja del tope: separa la que va a peor de la que solo llueve', () => {
    const weather = makeWeather({ icon: '01d', temperatureC: 25, windSpeedMs: 2 });
    const soloLluvia = computeBeachScore(
      weather, makeFlag({ color: 'green' }), makeEnrichment({ waves: 'débil', uvIndex: 4 }),
      undefined, makeRain(), null, ['Cruz Roja'], null,
    );
    const lluviaYPeor = computeBeachScore(
      weather, makeFlag({ color: 'green' }), makeEnrichment({ waves: 'débil', uvIndex: 4 }),
      undefined, makeRain(), null, ['Cruz Roja'], señal(-6),
    );

    expect(soloLluvia.score).toBe(RAIN_SCORE_CAP);
    expect(lluviaYPeor.score).toBe(RAIN_SCORE_CAP - 6);
  });

  it('sigue sin salirse de 0-100 con la señal en los extremos', () => {
    for (const delta of [-8, 8]) {
      for (const weather of [null, makeWeather({ icon: '10d', temperatureC: 5, windSpeedMs: 20 })]) {
        const { score } = computeBeachScore(
          weather, null, null, undefined, null, null, [], señal(delta),
        );
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('razones con previsión de las próximas horas', () => {
  const señal = (direccion: OutlookSignal['direccion']): OutlookSignal => ({
    delta: direccion === 'mejora' ? 6 : direccion === 'empeora' ? -6 : 0,
    direccion,
    horasConsideradas: 4,
    causa: direccion === 'mejora' ? 'despeja' : direccion === 'empeora' ? 'nubla' : null,
  });

  it('el ranking anuncia la mejora, al final y sin hora', () => {
    const weather = makeWeather({ icon: '04d', description: 'nubes', temperatureC: 20, windSpeedMs: 3 });
    const { subScores } = computeBeachScore(weather, null, null);
    const reason = buildRankingReason(subScores, weather, null, null, null, null, señal('mejora'));

    expect(reason).toContain('mejora en las próximas horas');
    expect(reason.endsWith('mejora en las próximas horas')).toBe(true);
  });

  it('el ranking NO vende un empeoramiento como razón para ir', () => {
    const weather = makeWeather({ icon: '01d', description: 'cielo claro' });
    const { subScores } = computeBeachScore(weather, null, null);
    const reason = buildRankingReason(subScores, weather, null, null, null, null, señal('empeora'));

    expect(reason).not.toContain('próximas horas');
  });

  it('el motivo de baja sí recoge el empeoramiento', () => {
    const weather = makeWeather({ icon: '04d', temperatureC: 20, windSpeedMs: 3 });
    const { subScores } = computeBeachScore(weather, null, null);

    expect(buildDowngradeFactors(subScores, null, null, null, ['Cruz Roja'], señal('empeora')))
      .toContain('empeora en las próximas horas');
    // Si es el único fragmento va en cabeza y se capitaliza, como cualquier
    // otro motivo; el cliente traduce sin distinguir mayúsculas.
    expect(buildCautionReason(subScores, weather, null, null, null, null, señal('empeora')))
      .toMatch(/empeora en las próximas horas/i);
  });

  it('un cambio pequeño (estable) no genera ninguna frase', () => {
    const weather = makeWeather({ icon: '04d', temperatureC: 20, windSpeedMs: 3 });
    const { subScores } = computeBeachScore(weather, null, null);

    expect(buildRankingReason(subScores, weather, null, null, null, null, señal('estable')))
      .not.toContain('próximas horas');
    expect(buildDowngradeFactors(subScores, null, null, null, ['Cruz Roja'], señal('estable')) ?? '')
      .not.toContain('próximas horas');
  });
});

describe('computeBeachScore — el tope que se aplicó', () => {
  const perfecta = () => ({
    weather: makeWeather({ icon: '01d', temperatureC: 25, windSpeedMs: 2 }),
    flag: makeFlag({ color: 'green' }),
    enrichment: makeEnrichment({ waves: 'débil', uvIndex: 4 }),
  });

  it('sin lluvia no hay tope', () => {
    const { weather, flag, enrichment } = perfecta();
    expect(computeBeachScore(weather, flag, enrichment).tope).toBeNull();
  });

  it('lluvia prevista → tope "lluvia_prevista"', () => {
    const { weather, flag, enrichment } = perfecta();
    const r = computeBeachScore(weather, flag, enrichment, undefined, null, makeForecastSignal());
    expect(r.tope).toBe('lluvia_prevista');
    expect(r.score).toBe(RAIN_FORECAST_SCORE_CAP);
  });

  it('lluvia activa gana: el tope reportado es "lluvia"', () => {
    const { weather, flag, enrichment } = perfecta();
    const r = computeBeachScore(weather, flag, enrichment, undefined, makeRain(), makeForecastSignal());
    expect(r.tope).toBe('lluvia');
  });

  it('si la nota ya estaba por debajo, el tope no recortó nada y no se reporta', () => {
    // Playa que ya estaba por debajo de 55 por sus propias condiciones.
    const mala = makeWeather({ icon: '04d', temperatureC: 12, windSpeedMs: 15 });
    const r = computeBeachScore(mala, null, null, undefined, makeRain(), null);

    expect(r.score).toBeLessThan(RAIN_SCORE_CAP);
    expect(r.tope).toBeNull();
  });
});

/**
 * Night in the ranking reason.
 *
 * The client prints these very words next to the beach headline, which is
 * night-aware: naming a sun at 3 a.m. here would contradict the same sky one
 * tap away. The day/night call is the provider's own, from the `d`/`n` suffix
 * on its icon.
 */
describe('buildRankingReason — de noche no hay sol que nombrar', () => {
  const base: SubScores = {
    cielo: 25, temperatura: 25, bandera: 20, viento: 15, oleaje: 10, datos: 5,
  };
  const cielo = (icon: string, description: string): Weather => ({
    source: 'OpenWeather',
    timestamp: Date.parse('2026-08-03T21:00:00.000Z'),
    temperatureC: 23,
    description,
    icon,
    conditionCode: 800,
    precipitationMm: null,
    windSpeedMs: 2,
    windDirectionDeg: 310,
    humidityPct: 70,
    pressureHPa: 1018,
  });

  it('«Sol» de día, «Despejado» de noche, para el mismo cielo', () => {
    expect(buildRankingReason(base, cielo('01d', 'cielo claro'), null)).toContain('Sol');
    expect(buildRankingReason(base, cielo('01n', 'cielo claro'), null)).toContain('Despejado');
    expect(buildRankingReason(base, cielo('01n', 'cielo claro'), null)).not.toContain('Sol');
  });

  it('lo mismo con el cielo parcialmente cubierto', () => {
    expect(buildRankingReason(base, cielo('02d', 'algo de nubes'), null))
      .toContain('Parcialmente soleado');
    expect(buildRankingReason(base, cielo('02n', 'algo de nubes'), null))
      .toContain('Parcialmente despejado');
  });

  it('«Nublado» no cambia: no había sol que quitar', () => {
    expect(buildRankingReason(base, cielo('04n', 'muy nuboso'), null)).toContain('Nublado');
  });
});

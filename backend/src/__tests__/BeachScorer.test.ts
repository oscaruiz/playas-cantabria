import { describe, it, expect } from 'vitest';
import {
  computeSkyScore,
  computeTemperatureScore,
  computeFlagScore,
  computeWindScore,
  computeWavesScore,
  computeUVScore,
  computeDataScore,
  computeBeachScore,
  buildRankingReason,
  buildCautionReason,
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

  it('returns max for optimal range', () => {
    expect(computeTemperatureScore(25)).toBe(17); // interpolated between 22-28
    expect(computeTemperatureScore(28)).toBe(20);
  });

  it('returns neutral for null', () => {
    expect(computeTemperatureScore(null)).toBe(7);
  });

  it('penalizes extreme heat', () => {
    const score33 = computeTemperatureScore(33);
    const score38 = computeTemperatureScore(38);
    expect(score33).toBe(17);
    expect(score38).toBeLessThan(score33);
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

  it('returns 6 for unknown', () => {
    expect(computeFlagScore(makeFlag({ color: 'unknown' }))).toBe(6);
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
// UV score
// ---------------------------------------------------------------------------

describe('computeUVScore', () => {
  it('returns max for low UV', () => {
    expect(computeUVScore(2)).toBe(5);
    expect(computeUVScore(5)).toBe(5);
  });

  it('returns lower for high UV', () => {
    expect(computeUVScore(8)).toBe(1);
    expect(computeUVScore(11)).toBe(0);
  });

  it('returns neutral for null', () => {
    expect(computeUVScore(null)).toBe(3);
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
    // All neutral values: 8+7+10+7+5+3+0 = 40
    expect(score).toBe(40);
  });

  it('score with no data (40) is below score with good data', () => {
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
      { cielo: 5, temperatura: 5, bandera: 0, viento: 3, oleaje: 5, uv: 3, datos: 0 },
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
// Lluvia detectada ahora (RainNowcast) → tope amarillo + razones
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
// Lluvia PREVISTA (RainForecastSignal) → tope amarillo suave 59 + razones
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

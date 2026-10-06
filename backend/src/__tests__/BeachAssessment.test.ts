import { describe, it, expect } from 'vitest';
import { assessBeach, BeachConditions, MIN_SCORE } from '../domain/use-cases/BeachAssessment';
import type { RainNowcast } from '../domain/entities/RainNowcast';

const NOW = new Date('2026-07-15T12:00:00Z');

function conditions(overrides: Partial<BeachConditions> = {}): BeachConditions {
  return {
    beach: {
      id: 'b1', name: 'Playa Test', municipality: 'Santander', aemetCode: '3907502',
      latitude: 43.47, longitude: -3.78,
    },
    weather: {
      source: 'OpenWeather', timestamp: NOW.getTime(), temperatureC: 24,
      description: 'clear sky', icon: '01d', windSpeedMs: 2,
      windDirectionDeg: 180, humidityPct: 50, pressureHPa: 1013,
    },
    flag: { color: 'green', timestamp: NOW.getTime() },
    enrichment: null,
    rain: null,
    ...overrides,
  };
}

describe('assessBeach', () => {
  it('recommends a sunny, calm, green-flag beach with its breakdown', () => {
    const r = assessBeach(conditions(), ['Cruz Roja'], NOW);
    expect(r.score).toBeGreaterThanOrEqual(MIN_SCORE);
    expect(r.reason).toBeTruthy();
    expect(r.subScores).toBeTruthy();
  });

  it('excludes a black-flag beach: score 0, the exclusion is the reason, no breakdown', () => {
    const r = assessBeach(conditions({ flag: { color: 'black', timestamp: NOW.getTime() } }), ['Cruz Roja'], NOW);
    expect(r.score).toBe(0);
    expect(r.downgradeReason).toBe(r.reason);
    expect(r.subScores).toBeUndefined();
  });

  it('scores a cold, cloudy, windy beach below MIN_SCORE without excluding it', () => {
    const c = conditions({ flag: null });
    const r = assessBeach({
      ...c,
      weather: { ...c.weather!, temperatureC: 12, icon: '04d', description: 'broken clouds', windSpeedMs: 11 },
    }, ['Cruz Roja'], NOW);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(MIN_SCORE);
    expect(r.subScores).toBeTruthy();
  });

  it('reads the injected clock for both the forecast-rain cap and the day window', () => {
    const at = (d: Date) => d.getTime();
    const slots = Array.from({ length: 12 }, (_, i) => ({
      timestamp: at(NOW) + i * 3600_000, cloudCoverPct: 0, temperatureC: 24, windSpeedMs: 2, precipitationMm: 0,
    }));
    const rainIn30Min: RainNowcast = {
      status: 'dry', precipitationMm: null, lastHourOnly: false, sources: [], timestamp: at(NOW),
      upcoming: { expected: true, firstAt: at(NOW) + 1800_000, mmMax: 1 },
      outlook: slots,
    };
    const assessAt = (now: Date) => assessBeach(
      conditions({ rain: rainIn30Min, flag: { color: 'green', timestamp: at(now) } }), ['Cruz Roja'], now,
    );

    // 14:00 Madrid, rain in half an hour: capped, and the afternoon is still ahead.
    const midday = assessAt(NOW);
    expect(midday.tope).toBe('lluvia_prevista');
    expect(midday.ventanaDia).toBeTruthy();

    // 04:00 Madrid, the same rain is ten hours away: no cap.
    expect(assessAt(new Date(at(NOW) - 10 * 3600_000)).tope).toBeNull();

    // 22:30 Madrid: the beach window is over, so there is no best time left.
    expect(assessAt(new Date('2026-07-15T20:30:00Z')).ventanaDia).toBeNull();
  });
});

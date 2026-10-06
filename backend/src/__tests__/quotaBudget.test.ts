import { describe, expect, it } from 'vitest';
import { peakOpenWeatherPerMinute } from '../scripts/quota-budget';

describe('quota budget peak calculation', () => {
  it('counts synchronized current refreshes, not a TTL average', () => {
    expect(peakOpenWeatherPerMinute([{ beaches: 40 }])).toBe(40);
  });

  it('adds the shared burst across every region', () => {
    expect(peakOpenWeatherPerMinute([{ beaches: 21 }, { beaches: 20 }])).toBe(41);
  });

  it('never exceeds the per-minute cap the host limiter enforces', () => {
    expect(peakOpenWeatherPerMinute([{ beaches: 51 }, { beaches: 14 }])).toBe(50);
  });
});

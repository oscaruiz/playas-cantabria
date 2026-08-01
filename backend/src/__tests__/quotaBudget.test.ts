import { describe, expect, it } from 'vitest';
import { peakOpenWeatherPerMinute } from '../scripts/quota-budget';

describe('quota budget peak calculation', () => {
  it('counts synchronized current refreshes, not a TTL average', () => {
    expect(peakOpenWeatherPerMinute([{ beaches: 61 }])).toBe(61);
  });

  it('adds the shared burst across every region', () => {
    expect(peakOpenWeatherPerMinute([{ beaches: 31 }, { beaches: 30 }])).toBe(61);
  });
});

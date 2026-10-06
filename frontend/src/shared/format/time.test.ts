import { madridDate, formatTimeAgo, madridLocalHour, madridMinutes } from './time';

// During the bathing season, Madrid is CEST (UTC+2): UTC + 2h = Madrid time.

// These two are the primitives the flag rules are built on (lifeguard hours and
// coverage season), so their timezone behaviour is tested directly and not only
// through `withinHours`.
describe('madridMinutes', () => {
  it('counts the minutes of the day in Madrid time, not the device time', () => {
    expect(madridMinutes(new Date('2026-07-15T14:30:00Z'))).toBe(16 * 60 + 30); // CEST
    expect(madridMinutes(new Date('2026-01-15T14:30:00Z'))).toBe(15 * 60 + 30); // CET
  });
});

describe('fechaMadrid', () => {
  it('gives the day in Madrid in YYYY-MM-DD format', () => {
    expect(madridDate(new Date('2026-07-15T10:00:00Z'))).toBe('2026-07-15');
  });

  it('in the small hours, the Madrid day is already the next one', () => {
    // 23:30 UTC on the 15th is 01:30 on the 16th in Madrid: comparing against the
    // coverage season with the UTC day would be off by one day.
    expect(madridDate(new Date('2026-07-15T23:30:00Z'))).toBe('2026-07-16');
  });
});

describe('formatearHaceTiempo', () => {
  const t = ((key: string, vars?: { n: number }) =>
    vars ? `${key}|${vars.n}` : key) as unknown as Parameters<typeof formatTimeAgo>[1];

  it('right now, minutes, hours and days', () => {
    expect(formatTimeAgo(Date.now(), t)).toBe('tiempo.ahoraMismo');
    expect(formatTimeAgo(Date.now() - 5 * 60000 - 100, t)).toBe('tiempo.haceMin|5');
    expect(formatTimeAgo(Date.now() - 3 * 3600000 - 1000, t)).toBe('tiempo.haceHoras|3');
    expect(formatTimeAgo(Date.now() - 2 * 86400000 - 1000, t)).toBe('tiempo.haceDias|2');
  });

  it('accepts ISO and returns "" if it does not parse', () => {
    expect(formatTimeAgo('no-es-fecha', t)).toBe('');
  });
});

describe('horaLocalMadrid', () => {
  it('converts a UTC ISO to Madrid HH:MM (CEST in summer)', () => {
    expect(madridLocalHour('2026-07-15T14:30:00Z')).toBe('16:30');
  });

  it('null for invalid or empty input', () => {
    expect(madridLocalHour('no-es-fecha')).toBeNull();
    expect(madridLocalHour(null)).toBeNull();
    expect(madridLocalHour(undefined)).toBeNull();
  });
});

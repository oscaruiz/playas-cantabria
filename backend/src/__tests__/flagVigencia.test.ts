import { describe, it, expect } from 'vitest';
import { esBanderaVigente } from '../application/mappers/flagVigencia';
import { FlagStatus } from '../domain/entities/Flag';

// Verano en Madrid = UTC+2. Todas las fechas dentro de la temporada 12-06..15-09.
const base: Omit<FlagStatus, 'timestamp'> = {
  color: 'green',
  message: 'Verde',
  coverageFrom: '12-06-2026',
  coverageTo: '15-09-2026',
  schedule: '11:30 - 19:30',
};

const flag = (ts: string, extra: Partial<FlagStatus> = {}): FlagStatus => ({
  ...base,
  timestamp: new Date(ts).getTime(),
  ...extra,
});

describe('esBanderaVigente', () => {
  it('vigente: dentro de horario y con dato de hoy', () => {
    const ahora = new Date('2026-07-10T13:00:00Z'); // 15:00 Madrid
    expect(esBanderaVigente(flag('2026-07-10T09:00:00Z'), ahora)).toBe(true);
  });

  it('no vigente: fuera de horario (noche)', () => {
    const ahora = new Date('2026-07-10T21:00:00Z'); // 23:00 Madrid
    expect(esBanderaVigente(flag('2026-07-10T16:00:00Z'), ahora)).toBe(false);
  });

  it('no vigente: dentro de horario pero el dato es de ayer', () => {
    const ahora = new Date('2026-07-10T13:00:00Z'); // 15:00 Madrid
    expect(esBanderaVigente(flag('2026-07-09T14:00:00Z'), ahora)).toBe(false);
  });

  it('no vigente: fuera de temporada', () => {
    const ahora = new Date('2026-09-20T13:00:00Z'); // 15:00 Madrid, tras coverageTo
    expect(esBanderaVigente(flag('2026-09-20T09:00:00Z'), ahora)).toBe(false);
  });

  it('sin horario conocido: vigente si el dato es de hoy', () => {
    const ahora = new Date('2026-07-10T13:00:00Z');
    expect(esBanderaVigente(flag('2026-07-10T09:00:00Z', { schedule: null }), ahora)).toBe(true);
  });

  it('sin horario y dato de ayer: no vigente (frescura)', () => {
    const ahora = new Date('2026-07-10T13:00:00Z');
    expect(esBanderaVigente(flag('2026-07-09T09:00:00Z', { schedule: null }), ahora)).toBe(false);
  });
});

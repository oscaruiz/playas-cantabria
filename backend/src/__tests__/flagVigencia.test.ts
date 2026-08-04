import { describe, it, expect } from 'vitest';
import { esBanderaVigente, vigenciaBandera } from '../domain/services/flagVigencia';
import { FlagStatus } from '../domain/entities/Flag';

// Summer in Madrid = UTC+2. All dates within the 12-06..15-09 season.
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
  it('vigente: dentro de horario y con dato reciente', () => {
    const ahora = new Date('2026-07-10T13:00:00Z'); // 15:00 Madrid
    expect(esBanderaVigente(flag('2026-07-10T09:00:00Z'), ahora)).toBe(true);
  });

  it('no vigente: fuera de horario (noche)', () => {
    const ahora = new Date('2026-07-10T21:00:00Z'); // 23:00 Madrid
    expect(esBanderaVigente(flag('2026-07-10T16:00:00Z'), ahora)).toBe(false);
  });

  it('NO vigente: el dato de ayer tarde ya no vale para hoy a mediodía', () => {
    // Antes se aceptaba: con 24h, la captura de ayer 18:35 Madrid era la más
    // fresca al abrir hoy y se pintaba como la que ondea. Son 17 h: nadie ha
    // confirmado ese color desde ayer por la tarde.
    const ahora = new Date('2026-07-10T09:45:00Z'); // 11:45 Madrid, dentro de horario
    expect(esBanderaVigente(flag('2026-07-09T16:35:00Z'), ahora)).toBe(false);
  });

  it('vigente con la captura de hace un rato: el cron pasa cada hora en franja', () => {
    const ahora = new Date('2026-07-10T13:00:00Z'); // 15:00 Madrid
    expect(esBanderaVigente(flag('2026-07-10T12:30:00Z'), ahora)).toBe(true); // 30 min
  });

  it('no vigente: dentro de horario pero el dato pasa de 8h', () => {
    const ahora = new Date('2026-07-10T13:00:00Z'); // 15:00 Madrid
    expect(esBanderaVigente(flag('2026-07-10T04:00:00Z'), ahora)).toBe(false); // 9h
  });

  it('no vigente: fuera de temporada', () => {
    const ahora = new Date('2026-09-20T13:00:00Z'); // 15:00 Madrid, after coverageTo
    expect(esBanderaVigente(flag('2026-09-20T09:00:00Z'), ahora)).toBe(false);
  });

  it('sin horario conocido: vigente si el dato es reciente', () => {
    const ahora = new Date('2026-07-10T13:00:00Z');
    expect(esBanderaVigente(flag('2026-07-10T09:00:00Z', { schedule: null }), ahora)).toBe(true);
  });

  it('sin horario y dato de hace >24h: no vigente (frescura)', () => {
    const ahora = new Date('2026-07-10T13:00:00Z');
    expect(esBanderaVigente(flag('2026-07-09T09:00:00Z', { schedule: null }), ahora)).toBe(false);
  });
});

/**
 * "No vigente" tapaba dos situaciones opuestas: que no haya servicio (no hay
 * bandera que perder) y que lo haya y hayamos perdido el dato. La segunda es la
 * peligrosa y necesita nombre propio.
 */
describe('vigenciaBandera', () => {
  it('vigente dentro de horario con dato reciente', () => {
    const ahora = new Date('2026-07-10T13:00:00Z'); // 15:00 Madrid
    expect(vigenciaBandera(flag('2026-07-10T09:00:00Z'), ahora)).toBe('vigente');
  });

  it('sin servicio de noche, aunque el dato sea de hace un rato', () => {
    const ahora = new Date('2026-07-10T21:00:00Z'); // 23:00 Madrid
    expect(vigenciaBandera(flag('2026-07-10T16:00:00Z'), ahora)).toBe('sin-servicio');
  });

  it('sin servicio fuera de temporada', () => {
    const ahora = new Date('2026-09-20T13:00:00Z');
    expect(vigenciaBandera(flag('2026-09-20T09:00:00Z'), ahora)).toBe('sin-servicio');
  });

  it('caducada dentro de horario con dato de hace más de 24 h', () => {
    const ahora = new Date('2026-07-10T13:00:00Z'); // 15:00 Madrid
    expect(vigenciaBandera(flag('2026-07-09T09:00:00Z'), ahora)).toBe('caducada'); // 28h
  });

  it('caducada también cuando no se conoce el horario', () => {
    const ahora = new Date('2026-07-10T13:00:00Z');
    expect(vigenciaBandera(flag('2026-07-09T09:00:00Z', { schedule: null }), ahora)).toBe('caducada');
  });
});

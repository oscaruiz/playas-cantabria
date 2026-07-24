import { describe, it, expect } from 'vitest';
import { aggregateFlags } from '../domain/services/flagAggregation';
import { FlagStatus } from '../domain/entities/Flag';

const f = (color: FlagStatus['color'], extra: Partial<FlagStatus> = {}): FlagStatus => ({
  color,
  timestamp: 1_000,
  ...extra,
});

describe('aggregateFlags — regla conservadora (la más restrictiva)', () => {
  it('sin puestos devuelve null', () => {
    expect(aggregateFlags([])).toBeNull();
    expect(aggregateFlags([null, null])).toBeNull();
  });

  it('elige la bandera MÁS restrictiva entre puestos con color', () => {
    expect(aggregateFlags([f('green'), f('yellow'), f('green')])?.color).toBe('yellow');
    expect(aggregateFlags([f('green'), f('red'), f('yellow')])?.color).toBe('red');
    expect(aggregateFlags([f('yellow'), f('black'), f('red')])?.color).toBe('black');
  });

  it('un puesto SIN color no cuenta como verde ni rebaja la bandera', () => {
    // Un puesto sin izar (sin color) junto a uno rojo → sigue siendo rojo.
    const res = aggregateFlags([f(undefined, { message: 'No hay información' }), f('red')]);
    expect(res?.color).toBe('red');
  });

  it("si NINGÚN puesto tiene color, conserva el estado con cobertura/horario", () => {
    const sinColor = f(undefined, { coverageFrom: '12-06-2026', schedule: '11:30 - 19:30' });
    const otro = f(undefined);
    const res = aggregateFlags([otro, sinColor]);
    expect(res?.color).toBeUndefined();
    expect(res?.coverageFrom).toBe('12-06-2026');
    expect(res?.schedule).toBe('11:30 - 19:30');
  });

  it('preserva cobertura/horario del puesto elegido (el más restrictivo)', () => {
    const verde = f('green', { schedule: '10:00 - 20:00' });
    const roja = f('red', { coverageFrom: '01-07-2026', schedule: '11:30 - 19:30' });
    const res = aggregateFlags([verde, roja]);
    expect(res?.color).toBe('red');
    expect(res?.schedule).toBe('11:30 - 19:30');
    expect(res?.coverageFrom).toBe('01-07-2026');
  });

  it('desempata por timestamp más reciente a igual severidad', () => {
    const viejo = f('yellow', { timestamp: 1_000, message: 'viejo' });
    const nuevo = f('yellow', { timestamp: 2_000, message: 'nuevo' });
    expect(aggregateFlags([viejo, nuevo])?.message).toBe('nuevo');
  });
});

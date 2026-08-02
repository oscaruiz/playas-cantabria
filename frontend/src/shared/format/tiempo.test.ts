import { fechaMadrid, formatearHaceTiempo, horaLocalMadrid, minutosMadrid } from './tiempo';

// During the bathing season, Madrid is CEST (UTC+2): UTC + 2h = Madrid time.

// These two are the primitives the flag rules are built on (lifeguard hours and
// coverage season), so their timezone behaviour is tested directly and not only
// through `dentroDeHorario`.
describe('minutosMadrid', () => {
  it('cuenta los minutos del día en hora de Madrid, no en la del dispositivo', () => {
    expect(minutosMadrid(new Date('2026-07-15T14:30:00Z'))).toBe(16 * 60 + 30); // CEST
    expect(minutosMadrid(new Date('2026-01-15T14:30:00Z'))).toBe(15 * 60 + 30); // CET
  });
});

describe('fechaMadrid', () => {
  it('da el día en Madrid en formato YYYY-MM-DD', () => {
    expect(fechaMadrid(new Date('2026-07-15T10:00:00Z'))).toBe('2026-07-15');
  });

  it('de madrugada, el día de Madrid ya es el siguiente', () => {
    // 23:30 UTC del 15 son las 01:30 del 16 en Madrid: comparar contra la
    // temporada de cobertura con el día UTC daría un día de menos.
    expect(fechaMadrid(new Date('2026-07-15T23:30:00Z'))).toBe('2026-07-16');
  });
});

describe('formatearHaceTiempo', () => {
  const t = ((clave: string, vars?: { n: number }) =>
    vars ? `${clave}|${vars.n}` : clave) as unknown as Parameters<typeof formatearHaceTiempo>[1];

  it('ahora mismo, minutos, horas y días', () => {
    expect(formatearHaceTiempo(Date.now(), t)).toBe('tiempo.ahoraMismo');
    expect(formatearHaceTiempo(Date.now() - 5 * 60000 - 100, t)).toBe('tiempo.haceMin|5');
    expect(formatearHaceTiempo(Date.now() - 3 * 3600000 - 1000, t)).toBe('tiempo.haceHoras|3');
    expect(formatearHaceTiempo(Date.now() - 2 * 86400000 - 1000, t)).toBe('tiempo.haceDias|2');
  });

  it('acepta ISO y devuelve "" si no parsea', () => {
    expect(formatearHaceTiempo('no-es-fecha', t)).toBe('');
  });
});

describe('horaLocalMadrid', () => {
  it('convierte un ISO UTC a HH:MM de Madrid (CEST en verano)', () => {
    expect(horaLocalMadrid('2026-07-15T14:30:00Z')).toBe('16:30');
  });

  it('null con entradas inválidas o vacías', () => {
    expect(horaLocalMadrid('no-es-fecha')).toBeNull();
    expect(horaLocalMadrid(null)).toBeNull();
    expect(horaLocalMadrid(undefined)).toBeNull();
  });
});

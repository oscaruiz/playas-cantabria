import { describe, it, expect } from 'vitest';
import { readFlagsFile } from '../regions/flagsFileSchema';

/**
 * flags.json era el único dato de región SIN esquema: bastaba con que `flags`
 * fuera un objeto. Un fichero con un color inventado o fechado en 2099 pasaba
 * la CI y llegaba a producción como dato de seguridad silenciosamente falso.
 */
const AHORA = new Date('2026-07-15T10:00:00Z');

const valido = {
  generatedAt: '2026-07-15T08:00:00.000Z',
  flags: {
    '30': {
      color: 'yellow',
      message: 'Amarilla',
      coverageFrom: '12-06-2026',
      coverageTo: '15-09-2026',
      schedule: '11:30 - 19:30',
    },
  },
};

describe('readFlagsFile', () => {
  it('acepta el fichero que escribe el scraper', () => {
    const { generatedAt, flags, errors } = readFlagsFile(valido, AHORA);

    expect(errors).toEqual([]);
    expect(generatedAt).toBe(Date.parse(valido.generatedAt));
    expect(flags.get(30)?.color).toBe('yellow');
  });

  it('rechaza un generatedAt en el futuro: una captura así no caduca nunca', () => {
    const { generatedAt, errors } = readFlagsFile(
      { ...valido, generatedAt: '2099-01-01T00:00:00.000Z' },
      AHORA,
    );

    expect(generatedAt).toBeNull();
    expect(errors.join(' ')).toContain('future');
  });

  it('rechaza un color que no es un color, y no lo deja pasar como bandera', () => {
    const { flags, errors } = readFlagsFile(
      { ...valido, flags: { '30': { ...valido.flags['30'], color: 'not-a-real-flag' } } },
      AHORA,
    );

    expect(errors).toHaveLength(1);
    expect(flags.size).toBe(0);
  });

  it('rechaza un id de puesto que no es un entero positivo', () => {
    const { flags, errors } = readFlagsFile(
      { ...valido, flags: { '0': valido.flags['30'], abc: valido.flags['30'] } },
      AHORA,
    );

    expect(errors).toHaveLength(2);
    expect(flags.size).toBe(0);
  });

  it('una entrada rota no se lleva por delante las buenas', () => {
    const { flags, errors } = readFlagsFile(
      { ...valido, flags: { '30': valido.flags['30'], '31': { color: 'azul' } } },
      AHORA,
    );

    expect(errors).toHaveLength(1);
    expect(flags.size).toBe(1);
    expect(flags.has(30)).toBe(true);
  });

  it('rechaza un fichero sin generatedAt o sin flags', () => {
    expect(readFlagsFile({ flags: {} }, AHORA).errors).not.toEqual([]);
    expect(readFlagsFile({ generatedAt: valido.generatedAt }, AHORA).errors).not.toEqual([]);
    expect(readFlagsFile('nope', AHORA).errors).not.toEqual([]);
  });

  it('acepta una bandera arriada (color null) y un color desconocido no cuela', () => {
    const arriada = readFlagsFile(
      { ...valido, flags: { '30': { ...valido.flags['30'], color: null } } },
      AHORA,
    );

    expect(arriada.errors).toEqual([]);
    expect(arriada.flags.get(30)?.color).toBeNull();
  });
});

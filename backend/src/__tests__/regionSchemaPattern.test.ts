import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseRegionConfig } from '../regions/regionSchema';

/**
 * `nombrePattern` is contributed data compiled with `new RegExp` and run
 * against catalog names: the only place where a region's data becomes
 * executable behaviour. Capping its length did not bound its COST — `(a+)+$`
 * is six characters and grows exponentially with the input, enough to hang
 * validation, CI or startup from a pull request that looks fine.
 */
const cantabria = JSON.parse(
  readFileSync(resolve(__dirname, '../../../regions/cantabria/region.json'), 'utf-8'),
);

function conPatron(nombrePattern: string) {
  return {
    ...cantabria,
    catalogRules: {
      ...cantabria.catalogRules,
      forbiddenBeaches: [{ municipio: 'santander', nombrePattern }],
    },
  };
}

describe('nombrePattern — patrones seguros', () => {
  it('acepta el patrón real de Cantabria', () => {
    expect(() => parseRegionConfig(conPatron('^(la )?concha( de santander)?$'))).not.toThrow();
  });

  it('acepta alternancia y anclas sin repetición', () => {
    expect(() => parseRegionConfig(conPatron('^(concha|arenal|puntal)$'))).not.toThrow();
  });

  it.each([
    ['(a+)+$', 'ReDoS clásico'],
    ['^(x*)*$', 'cuantificador anidado'],
    ['^(a|aa)+$', 'alternancia solapada bajo +'],
    ['^a{1,5000}$', 'repetición acotada enorme'],
    ['^(a|aa){40}$', 'repetición exacta de un cuerpo ambiguo'],
  ])('rechaza %s (%s)', (patron) => {
    expect(() => parseRegionConfig(conPatron(patron))).toThrow();
  });

  it('rechaza un patrón que ni siquiera compila', () => {
    expect(() => parseRegionConfig(conPatron('^(sin cerrar'))).toThrow();
  });

  it('un patrón aceptado se evalúa en tiempo despreciable', () => {
    const region = parseRegionConfig(conPatron('^(la )?concha( de santander)?$'));
    const regex = region.catalogRules.forbiddenBeaches[0].nombre;
    const cebo = 'a'.repeat(60);
    const inicio = Date.now();
    regex.test(cebo);
    expect(Date.now() - inicio).toBeLessThan(50);
  });
});

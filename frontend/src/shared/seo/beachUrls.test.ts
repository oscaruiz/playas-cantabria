import { slugify, beachPath, findBySlugs, detectCollisions } from './beachUrls';
import { beachesResponse } from '../../test/fixtures/beaches';
import catalogoReal from '../../data/beaches.json';

describe('slugify', () => {
  it('quita tildes y diéresis', () => {
    expect(slugify('La Arnía')).toBe('la-arnia');
    expect(slugify('Trengandín')).toBe('trengandin');
    expect(slugify('Ribamontán al Mar')).toBe('ribamontan-al-mar');
  });

  it('la eñe no desaparece: se convierte en n', () => {
    expect(slugify('Peñacastillo')).toBe('penacastillo');
  });

  it('apóstrofos y símbolos se vuelven un solo guion', () => {
    expect(slugify("L'Escala")).toBe('l-escala');
    expect(slugify("L'Ampolla")).toBe('l-ampolla');
    expect(slugify('San Vicente de la Barquera')).toBe('san-vicente-de-la-barquera');
  });

  it('colapsa separadores repetidos y recorta guiones en los bordes', () => {
    expect(slugify('  La   Salvé -- (Laredo) ')).toBe('la-salve-laredo');
  });

  it('un nombre sin nada alfanumérico queda vacío (y eso es un error de datos)', () => {
    expect(slugify('---')).toBe('');
  });
});

describe('beachPath', () => {
  it('compone /playas/<municipio>/<nombre> con ambos slugs', () => {
    expect(beachPath({ nombre: 'La Concha', municipio: 'Suances' })).toBe(
      '/playas/suances/la-concha'
    );
    expect(beachPath({ nombre: 'La Arnía', municipio: 'Piélagos' })).toBe(
      '/playas/pielagos/la-arnia'
    );
  });
});

describe('findBySlugs', () => {
  it('cada playa del fixture se reencuentra por su propia ruta', () => {
    for (const beach of beachesResponse) {
      const path = beachPath(beach);
      const [, , municipalitySlug, beachSlug] = path.split('/');
      expect(findBySlugs(beachesResponse, municipalitySlug, beachSlug)?.codigo).toBe(
        beach.codigo
      );
    }
  });

  it('devuelve undefined para slugs desconocidos', () => {
    expect(findBySlugs(beachesResponse, 'suances', 'no-existe')).toBeUndefined();
    expect(findBySlugs(beachesResponse, 'nadie', 'la-concha')).toBeUndefined();
  });
});

describe('detectCollisions', () => {
  it('el catálogo real de la región construida no tiene colisiones', () => {
    // If this fails, two beaches map to the same canonical URL (or a name
    // slugs to nothing): fix the catalog, do not weaken the check.
    expect(detectCollisions(catalogoReal)).toEqual([]);
  });

  it('dos playas homónimas del mismo municipio se detectan', () => {
    const collision = detectCollisions([
      { nombre: 'La Arena', municipio: 'Arnuero', codigo: '1' },
      { nombre: 'La aréna', municipio: 'Arnuero', codigo: '2' },
    ]);
    expect(collision).toEqual([{ ruta: '/playas/arnuero/la-arena', codigos: ['1', '2'] }]);
  });

  it('un nombre que sluggea a vacío también es conflicto', () => {
    expect(detectCollisions([{ nombre: '···', municipio: 'X', codigo: '9' }])).toEqual([
      { ruta: '(slug vacío)', codigos: ['9'] },
    ]);
  });
});

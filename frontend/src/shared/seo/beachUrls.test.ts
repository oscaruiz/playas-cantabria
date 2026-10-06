import { slugify, beachPath, findBySlugs, detectCollisions } from './beachUrls';
import { beachesResponse } from '../../test/fixtures/beaches';
import catalogoReal from '../../data/beaches.json';

describe('slugify', () => {
  it('strips accents and diaereses', () => {
    expect(slugify('La Arnía')).toBe('la-arnia');
    expect(slugify('Trengandín')).toBe('trengandin');
    expect(slugify('Ribamontán al Mar')).toBe('ribamontan-al-mar');
  });

  it('the eñe does not vanish: it becomes n', () => {
    expect(slugify('Peñacastillo')).toBe('penacastillo');
  });

  it('apostrophes and symbols become a single dash', () => {
    expect(slugify("L'Escala")).toBe('l-escala');
    expect(slugify("L'Ampolla")).toBe('l-ampolla');
    expect(slugify('San Vicente de la Barquera')).toBe('san-vicente-de-la-barquera');
  });

  it('collapses repeated separators and trims dashes at the edges', () => {
    expect(slugify('  La   Salvé -- (Laredo) ')).toBe('la-salve-laredo');
  });

  it('a name with nothing alphanumeric ends up empty (and that is a data error)', () => {
    expect(slugify('---')).toBe('');
  });
});

describe('beachPath', () => {
  it('builds /playas/<municipio>/<nombre> with both slugs', () => {
    expect(beachPath({ nombre: 'La Concha', municipio: 'Suances' })).toBe(
      '/playas/suances/la-concha'
    );
    expect(beachPath({ nombre: 'La Arnía', municipio: 'Piélagos' })).toBe(
      '/playas/pielagos/la-arnia'
    );
  });
});

describe('findBySlugs', () => {
  it('every beach in the fixture is found again by its own route', () => {
    for (const beach of beachesResponse) {
      const path = beachPath(beach);
      const [, , municipalitySlug, beachSlug] = path.split('/');
      expect(findBySlugs(beachesResponse, municipalitySlug, beachSlug)?.codigo).toBe(
        beach.codigo
      );
    }
  });

  it('returns undefined for unknown slugs', () => {
    expect(findBySlugs(beachesResponse, 'suances', 'no-existe')).toBeUndefined();
    expect(findBySlugs(beachesResponse, 'nadie', 'la-concha')).toBeUndefined();
  });
});

describe('detectCollisions', () => {
  it('the real catalog of the built region has no collisions', () => {
    // If this fails, two beaches map to the same canonical URL (or a name
    // slugs to nothing): fix the catalog, do not weaken the check.
    expect(detectCollisions(catalogoReal)).toEqual([]);
  });

  it('two same-named beaches in the same municipality are detected', () => {
    const collision = detectCollisions([
      { nombre: 'La Arena', municipio: 'Arnuero', codigo: '1' },
      { nombre: 'La aréna', municipio: 'Arnuero', codigo: '2' },
    ]);
    expect(collision).toEqual([{ ruta: '/playas/arnuero/la-arena', codigos: ['1', '2'] }]);
  });

  it('a name that slugs to empty is also a conflict', () => {
    expect(detectCollisions([{ nombre: '···', municipio: 'X', codigo: '9' }])).toEqual([
      { ruta: '(slug vacío)', codigos: ['9'] },
    ]);
  });
});

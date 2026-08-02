import { slugify, rutaPlaya, encontrarPorSlugs, detectarColisiones } from './beachUrls';
import { beachesResponse } from '../test/fixtures/beaches';
import catalogoReal from '../data/beaches.json';

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

describe('rutaPlaya', () => {
  it('compone /playas/<municipio>/<nombre> con ambos slugs', () => {
    expect(rutaPlaya({ nombre: 'La Concha', municipio: 'Suances' })).toBe(
      '/playas/suances/la-concha'
    );
    expect(rutaPlaya({ nombre: 'La Arnía', municipio: 'Piélagos' })).toBe(
      '/playas/pielagos/la-arnia'
    );
  });
});

describe('encontrarPorSlugs', () => {
  it('cada playa del fixture se reencuentra por su propia ruta', () => {
    for (const playa of beachesResponse) {
      const ruta = rutaPlaya(playa);
      const [, , municipioSlug, playaSlug] = ruta.split('/');
      expect(encontrarPorSlugs(beachesResponse, municipioSlug, playaSlug)?.codigo).toBe(
        playa.codigo
      );
    }
  });

  it('devuelve undefined para slugs desconocidos', () => {
    expect(encontrarPorSlugs(beachesResponse, 'suances', 'no-existe')).toBeUndefined();
    expect(encontrarPorSlugs(beachesResponse, 'nadie', 'la-concha')).toBeUndefined();
  });
});

describe('detectarColisiones', () => {
  it('el catálogo real de la región construida no tiene colisiones', () => {
    // If this fails, two beaches map to the same canonical URL (or a name
    // slugs to nothing): fix the catalog, do not weaken the check.
    expect(detectarColisiones(catalogoReal)).toEqual([]);
  });

  it('dos playas homónimas del mismo municipio se detectan', () => {
    const colision = detectarColisiones([
      { nombre: 'La Arena', municipio: 'Arnuero', codigo: '1' },
      { nombre: 'La aréna', municipio: 'Arnuero', codigo: '2' },
    ]);
    expect(colision).toEqual([{ ruta: '/playas/arnuero/la-arena', codigos: ['1', '2'] }]);
  });

  it('un nombre que sluggea a vacío también es conflicto', () => {
    expect(detectarColisiones([{ nombre: '···', municipio: 'X', codigo: '9' }])).toEqual([
      { ruta: '(slug vacío)', codigos: ['9'] },
    ]);
  });
});

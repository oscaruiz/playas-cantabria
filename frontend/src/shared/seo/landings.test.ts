import {
  LANDINGS,
  nonEmptyLandings,
  municipalitiesOf,
  municipalityPath,
  municipalitiesSummary,
  beachesOfMunicipalitySlug,
} from './landings';
import { beachesResponse } from '../../test/fixtures/beaches';
import catalogoReal from '../../data/beaches.json';

function byId(id: string): { id: string; filtro: (p: unknown) => boolean } {
  const landing = LANDINGS.find((l: { id: string }) => l.id === id);
  if (!landing) throw new Error(`landing ${id} no existe`);
  return landing;
}

describe('selectores de landings (solo datos estáticos del catálogo)', () => {
  it('webcam: presente y no desactivada', () => {
    const filter = byId('playas-con-webcam').filtro;
    const names = beachesResponse.filter(filter).map((p) => p.nombre);
    expect(names).toContain('La Concha');
    // La Salvé has a webcam with estado 'desactivada': out.
    expect(names).not.toContain('La Salvé');
  });

  it('accesible: solo el atributo explícito a true; ausente = desconocido, fuera', () => {
    const filter = byId('playas-accesibles').filtro;
    expect(filter({ atributos: { accesible: true } })).toBe(true);
    expect(filter({ atributos: { accesible: false } })).toBe(false);
    expect(filter({ atributos: {} })).toBe(false);
    expect(filter({})).toBe(false);
  });

  it('socorrista: puesto con id > 0 o idCruzRoja > 0 (el 0 es "sin cobertura")', () => {
    const filter = byId('playas-con-socorrista').filtro;
    expect(filter({ cruzRojaStations: [{ id: 373 }] })).toBe(true);
    expect(filter({ idCruzRoja: 310 })).toBe(true);
    expect(filter({ idCruzRoja: 0 })).toBe(false);
    expect(filter({ cruzRojaStations: [{}] })).toBe(false);
    expect(filter({})).toBe(false);
  });

  it('surf: solo el atributo explícito', () => {
    const filter = byId('playas-para-surf').filtro;
    expect(filter({ atributos: { surf: true } })).toBe(true);
    expect(filter({ atributos: { surf: false } })).toBe(false);
    expect(filter({})).toBe(false);
  });

  it('no existe una landing de familias: el catálogo no tiene ese dato', () => {
    expect(
      LANDINGS.find((l: { id: string }) => l.id === 'playas-para-familias')
    ).toBeUndefined();
  });
});

describe('categorías vacías nunca se publican', () => {
  it('con un catálogo vacío no hay landings', () => {
    expect(nonEmptyLandings([])).toEqual([]);
  });

  it('en el catálogo real de la región construida las cuatro tienen playas', () => {
    expect(nonEmptyLandings(catalogoReal).map((l: { id: string }) => l.id)).toEqual([
      'playas-con-webcam',
      'playas-accesibles',
      'playas-con-socorrista',
      'playas-para-surf',
    ]);
  });
});

describe('municipios', () => {
  it('únicos y ordenados', () => {
    expect(municipalitiesOf(beachesResponse)).toEqual([
      'Laredo',
      'Piélagos',
      'Ribamontán al Mar',
      'Santander',
      'Suances',
    ]);
  });

  it('la ruta usa el mismo slugify que las playas', () => {
    expect(municipalityPath('Ribamontán al Mar')).toBe('/municipios/ribamontan-al-mar');
  });

  it('el resumen del índice trae ruta y número de playas por municipio', () => {
    const summary = municipalitiesSummary(beachesResponse);
    expect(summary).toContainEqual({
      municipio: 'Santander',
      ruta: '/municipios/santander',
      total: 2,
    });
    expect(summary).toContainEqual({
      municipio: 'Suances',
      ruta: '/municipios/suances',
      total: 1,
    });
    expect(summary.map((m: { municipio: string }) => m.municipio)).toEqual(
      municipalitiesOf(beachesResponse)
    );
  });

  it('el slug reencuentra sus playas; uno desconocido, ninguna', () => {
    const fromSantander = beachesOfMunicipalitySlug(beachesResponse, 'santander');
    expect(fromSantander.map((p: { nombre: string }) => p.nombre).sort()).toEqual([
      'El Sardinero',
      'La Maruca',
    ]);
    expect(beachesOfMunicipalitySlug(beachesResponse, 'no-existe')).toEqual([]);
  });
});

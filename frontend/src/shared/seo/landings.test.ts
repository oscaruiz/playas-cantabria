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

describe('landing selectors (static catalog data only)', () => {
  it('webcam: present and not disabled', () => {
    const filter = byId('playas-con-webcam').filtro;
    const names = beachesResponse.filter(filter).map((p) => p.nombre);
    expect(names).toContain('La Concha');
    // La Salvé has a webcam with estado 'desactivada': out.
    expect(names).not.toContain('La Salvé');
  });

  it('accessible: only the explicit attribute set to true; absent = unknown, out', () => {
    const filter = byId('playas-accesibles').filtro;
    expect(filter({ atributos: { accesible: true } })).toBe(true);
    expect(filter({ atributos: { accesible: false } })).toBe(false);
    expect(filter({ atributos: {} })).toBe(false);
    expect(filter({})).toBe(false);
  });

  it('lifeguard: post with id > 0 or idCruzRoja > 0 (0 means "no coverage")', () => {
    const filter = byId('playas-con-socorrista').filtro;
    expect(filter({ cruzRojaStations: [{ id: 373 }] })).toBe(true);
    expect(filter({ idCruzRoja: 310 })).toBe(true);
    expect(filter({ idCruzRoja: 0 })).toBe(false);
    expect(filter({ cruzRojaStations: [{}] })).toBe(false);
    expect(filter({})).toBe(false);
  });

  it('surf: only the explicit attribute', () => {
    const filter = byId('playas-para-surf').filtro;
    expect(filter({ atributos: { surf: true } })).toBe(true);
    expect(filter({ atributos: { surf: false } })).toBe(false);
    expect(filter({})).toBe(false);
  });

  it('there is no families landing: the catalog has no such data', () => {
    expect(
      LANDINGS.find((l: { id: string }) => l.id === 'playas-para-familias')
    ).toBeUndefined();
  });
});

describe('empty categories are never published', () => {
  it('with an empty catalog there are no landings', () => {
    expect(nonEmptyLandings([])).toEqual([]);
  });

  it('in the real catalog of the built region all four have beaches', () => {
    expect(nonEmptyLandings(catalogoReal).map((l: { id: string }) => l.id)).toEqual([
      'playas-con-webcam',
      'playas-accesibles',
      'playas-con-socorrista',
      'playas-para-surf',
    ]);
  });
});

describe('municipalities', () => {
  it('unique and sorted', () => {
    expect(municipalitiesOf(beachesResponse)).toEqual([
      'Laredo',
      'Piélagos',
      'Ribamontán al Mar',
      'Santander',
      'Suances',
    ]);
  });

  it('the route uses the same slugify as the beaches', () => {
    expect(municipalityPath('Ribamontán al Mar')).toBe('/municipios/ribamontan-al-mar');
  });

  it('the index summary carries route and beach count per municipality', () => {
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

  it('the slug finds its beaches again; an unknown one, none', () => {
    const fromSantander = beachesOfMunicipalitySlug(beachesResponse, 'santander');
    expect(fromSantander.map((p: { nombre: string }) => p.nombre).sort()).toEqual([
      'El Sardinero',
      'La Maruca',
    ]);
    expect(beachesOfMunicipalitySlug(beachesResponse, 'no-existe')).toEqual([]);
  });
});

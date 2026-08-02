import {
  LANDINGS,
  landingsNoVacias,
  municipiosDe,
  rutaMunicipio,
  playasDeMunicipioSlug,
} from './landings';
import { beachesResponse } from '../test/fixtures/beaches';
import catalogoReal from '../data/beaches.json';

function porId(id: string): { id: string; filtro: (p: unknown) => boolean } {
  const landing = LANDINGS.find((l: { id: string }) => l.id === id);
  if (!landing) throw new Error(`landing ${id} no existe`);
  return landing;
}

describe('selectores de landings (solo datos estáticos del catálogo)', () => {
  it('webcam: presente y no desactivada', () => {
    const filtro = porId('playas-con-webcam').filtro;
    const nombres = beachesResponse.filter(filtro).map((p) => p.nombre);
    expect(nombres).toContain('La Concha');
    // La Salvé has a webcam with estado 'desactivada': out.
    expect(nombres).not.toContain('La Salvé');
  });

  it('accesible: solo el atributo explícito a true; ausente = desconocido, fuera', () => {
    const filtro = porId('playas-accesibles').filtro;
    expect(filtro({ atributos: { accesible: true } })).toBe(true);
    expect(filtro({ atributos: { accesible: false } })).toBe(false);
    expect(filtro({ atributos: {} })).toBe(false);
    expect(filtro({})).toBe(false);
  });

  it('socorrista: puesto con id > 0 o idCruzRoja > 0 (el 0 es "sin cobertura")', () => {
    const filtro = porId('playas-con-socorrista').filtro;
    expect(filtro({ cruzRojaStations: [{ id: 373 }] })).toBe(true);
    expect(filtro({ idCruzRoja: 310 })).toBe(true);
    expect(filtro({ idCruzRoja: 0 })).toBe(false);
    expect(filtro({ cruzRojaStations: [{}] })).toBe(false);
    expect(filtro({})).toBe(false);
  });

  it('surf: solo el atributo explícito', () => {
    const filtro = porId('playas-para-surf').filtro;
    expect(filtro({ atributos: { surf: true } })).toBe(true);
    expect(filtro({ atributos: { surf: false } })).toBe(false);
    expect(filtro({})).toBe(false);
  });

  it('no existe una landing de familias: el catálogo no tiene ese dato', () => {
    expect(
      LANDINGS.find((l: { id: string }) => l.id === 'playas-para-familias')
    ).toBeUndefined();
  });
});

describe('categorías vacías nunca se publican', () => {
  it('con un catálogo vacío no hay landings', () => {
    expect(landingsNoVacias([])).toEqual([]);
  });

  it('en el catálogo real de la región construida las cuatro tienen playas', () => {
    expect(landingsNoVacias(catalogoReal).map((l: { id: string }) => l.id)).toEqual([
      'playas-con-webcam',
      'playas-accesibles',
      'playas-con-socorrista',
      'playas-para-surf',
    ]);
  });
});

describe('municipios', () => {
  it('únicos y ordenados', () => {
    expect(municipiosDe(beachesResponse)).toEqual([
      'Laredo',
      'Piélagos',
      'Ribamontán al Mar',
      'Santander',
      'Suances',
    ]);
  });

  it('la ruta usa el mismo slugify que las playas', () => {
    expect(rutaMunicipio('Ribamontán al Mar')).toBe('/municipios/ribamontan-al-mar');
  });

  it('el slug reencuentra sus playas; uno desconocido, ninguna', () => {
    const deSantander = playasDeMunicipioSlug(beachesResponse, 'santander');
    expect(deSantander.map((p: { nombre: string }) => p.nombre).sort()).toEqual([
      'El Sardinero',
      'La Maruca',
    ]);
    expect(playasDeMunicipioSlug(beachesResponse, 'no-existe')).toEqual([]);
  });
});

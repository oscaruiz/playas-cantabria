import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateBeachCatalog, normalizeName } from '../domain/services/beachCatalogValidation';

const backendPath = resolve(__dirname, '../../data/beaches.json');
const frontendPath = resolve(__dirname, '../../../frontend/src/data/beaches.json');

const backend = JSON.parse(readFileSync(backendPath, 'utf-8')) as any[];

describe('Catálogo de playas — integridad', () => {
  it('no tiene errores de integridad', () => {
    const { errors } = validateBeachCatalog(backend);
    expect(errors).toEqual([]);
  });

  it('no hay ids de Cruz Roja duplicados entre playas (el 373 pre-existente ya está corregido)', () => {
    // El id 373 (LA CONCHA I SUANCES) estaba mal asignado a Mogro-Usil; ya se
    // corrigió a MOGRO=376. No debe quedar ningún id compartido entre playas.
    const { warnings } = validateBeachCatalog(backend);
    expect(warnings).toEqual([]);
  });

  it('no existe "La Concha de Santander"', () => {
    const hit = backend.find(
      (b) => normalizeName(b.municipio) === 'santander' && /concha/.test(normalizeName(b.nombre))
    );
    expect(hit).toBeUndefined();
  });

  it('el fallback del frontend NO diverge del backend', () => {
    const frontend = JSON.parse(readFileSync(frontendPath, 'utf-8'));
    expect(frontend).toEqual(backend);
  });
});

describe('Catálogo de playas — altas nuevas (nombres + ids explícitos)', () => {
  // Comprobación explícita: no basta con el total; se exige que cada alta exista
  // con su nombre, municipio e id interno (codigo) concretos.
  const NUEVAS: Array<{ nombre: string; municipio: string; codigo: string }> = [
    { nombre: 'Bikinis', municipio: 'Santander', codigo: '3907590' },
    { nombre: 'El Camello', municipio: 'Santander', codigo: '3907591' },
    { nombre: 'El Bocal', municipio: 'Santander', codigo: '3907592' },
    { nombre: 'La Maruca', municipio: 'Santander', codigo: '3907593' },
    { nombre: 'Los Peligros', municipio: 'Santander', codigo: '3907594' },
    { nombre: 'Mataleñas', municipio: 'Santander', codigo: '3907595' },
    { nombre: 'Virgen del Mar', municipio: 'Santander', codigo: '3907596' },
    { nombre: 'Canallave', municipio: 'Piélagos', codigo: '3905290' },
    { nombre: 'La Arnía', municipio: 'Piélagos', codigo: '3905291' },
    { nombre: 'Portio', municipio: 'Piélagos', codigo: '3905292' },
    { nombre: 'Somocuevas', municipio: 'Piélagos', codigo: '3905293' },
    { nombre: 'El Puntal', municipio: 'Ribamontán al Mar', codigo: '3906190' },
    { nombre: 'Galizano', municipio: 'Ribamontán al Mar', codigo: '3906191' },
    { nombre: 'Langre', municipio: 'Ribamontán al Mar', codigo: '3906192' },
    { nombre: 'Loredo', municipio: 'Ribamontán al Mar', codigo: '3906193' },
    { nombre: 'El Cabo / Gerra / Bederna', municipio: 'San Vicente de la Barquera', codigo: '3908090' },
    { nombre: 'El Tostadero', municipio: 'San Vicente de la Barquera', codigo: '3908091' },
    { nombre: 'Berria', municipio: 'Santoña', codigo: '3907990' },
    { nombre: 'Helgueras', municipio: 'Noja', codigo: '3904790' },
    { nombre: 'Trengandín', municipio: 'Noja', codigo: '3904791' },
    { nombre: 'La Ribera', municipio: 'Suances', codigo: '3908590' },
    { nombre: 'Los Locos', municipio: 'Suances', codigo: '3908591' },
    { nombre: 'Covachos', municipio: 'Santa Cruz de Bezana', codigo: '3907390' },
    { nombre: 'Usgo', municipio: 'Miengo', codigo: '3904490' },
    { nombre: 'Punta Parayas', municipio: 'Camargo', codigo: '3901690' },
  ];

  it('incorpora exactamente 25 playas nuevas (46 en total)', () => {
    expect(backend.length).toBe(46);
  });

  it.each(NUEVAS)('$nombre ($municipio) existe una sola vez con codigo $codigo', ({ nombre, municipio, codigo }) => {
    const matches = backend.filter((b) => b.nombre === nombre && b.municipio === municipio);
    expect(matches).toHaveLength(1);
    expect(matches[0].codigo).toBe(codigo);
  });

  it('todas las playas sin AEMET (código sintético 9x) están marcadas sinAemet', () => {
    for (const { codigo } of NUEVAS) {
      const b = backend.find((x) => x.codigo === codigo);
      expect(b?.sinAemet, `${codigo} debe ser sinAemet`).toBe(true);
    }
  });

  it('toda playa nueva tiene ≥1 puesto de Cruz Roja con id verificado (>0)', () => {
    for (const { nombre, codigo } of NUEVAS) {
      const b = backend.find((x) => x.codigo === codigo);
      const conId = (b?.cruzRojaStations ?? []).filter((s: any) => typeof s.id === 'number' && s.id > 0);
      expect(conId.length, `${nombre} debe tener puestos con id`).toBeGreaterThan(0);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { validateBeachCatalog, normalizeName } from '../domain/services/beachCatalogValidation';
// Strict resolver, not the compatibility fallback: validating a different
// region's catalog here would pass and tell us nothing about Cantabria.
import { resolveScriptRegion } from '../scripts/scriptRegion';

const cantabria = resolveScriptRegion('cantabria');

const backendPath = cantabria.catalogPath;
const frontendPath = resolve(__dirname, '../../../frontend/src/data/beaches.json');

const backend = JSON.parse(readFileSync(backendPath, 'utf-8')) as any[];

describe('Catálogo de playas — integridad', () => {
  it('no tiene errores de integridad', () => {
    const { errors } = validateBeachCatalog(backend, cantabria.catalogRules);
    expect(errors).toEqual([]);
  });

  it('no hay ids de Cruz Roja duplicados entre playas (el 373 pre-existente ya está corregido)', () => {
    // The id 373 (LA CONCHA I SUANCES) was wrongly assigned to Mogro-Usil; it has
    // already been corrected to MOGRO=376. No id must remain shared between beaches.
    const { warnings } = validateBeachCatalog(backend, cantabria.catalogRules);
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
  // Explicit check: the total is not enough; each addition is required to exist
  // with its specific name, municipality and internal id (codigo).
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

  it('incorpora exactamente 25 playas nuevas (51 en total tras las altas de ago-2026)', () => {
    expect(backend.length).toBe(51);
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

describe('Catálogo de playas — altas de agosto de 2026', () => {
  // Coves with no lifeguard service: unlike the July batch, having no Cruz
  // Roja station is the verified truth here, not missing data.
  const ALTAS_AGO_2026: Array<{ nombre: string; municipio: string; codigo: string }> = [
    { nombre: 'Arenal de Sonabia', municipio: 'Liendo', codigo: '3903690' },
    { nombre: 'San Julián', municipio: 'Liendo', codigo: '3903691' },
    { nombre: 'Los Caballos', municipio: 'Miengo', codigo: '3904491' },
    // Blue Flag 2026 beaches that were missing from the catalog. idCruzRoja 0
    // like their municipality siblings: Castro Urdiales and Arnuero do not
    // operate with Cruz Roja in this catalog.
    { nombre: 'Brazomar', municipio: 'Castro Urdiales', codigo: '3902090' },
    { nombre: 'El Sable de Quejo', municipio: 'Arnuero', codigo: '3900690' },
  ];

  it.each(ALTAS_AGO_2026)('$nombre ($municipio) existe una sola vez con codigo $codigo y sinAemet', ({ nombre, municipio, codigo }) => {
    const matches = backend.filter((b) => b.nombre === nombre && b.municipio === municipio);
    expect(matches).toHaveLength(1);
    expect(matches[0].codigo).toBe(codigo);
    expect(matches[0].sinAemet).toBe(true);
  });
});

describe('Catálogo de playas — Bandera Azul (concesión anual, ADEAC)', () => {
  // The award is per-year: this list is the 2026 grant and must be renewed
  // when ADEAC publishes each season. Exactly these and no others — Cuberris
  // (Bareyo) matches "Ris" by substring but is NOT awarded.
  const AZULES_2026 = [
    '3900602', // La Arena (Arnuero)
    '3900690', // El Sable de Quejo (Arnuero)
    '3902002', // Oriñón (Castro Urdiales)
    '3902004', // Ostende (Castro Urdiales)
    '3902090', // Brazomar (Castro Urdiales)
    '3904701', // Ris (Noja)
    '3904790', // Helgueras (Noja)
    '3904791', // Trengandín (Noja)
    '3908004', // El Sable de Merón (San Vicente de la Barquera)
    '3908591', // Los Locos (Suances)
    '3908599', // Tagle (Suances)
  ];

  it('exactamente 11 playas llevan banderaAzul 2026', () => {
    const azules = backend.filter((b) => b.banderaAzul === 2026).map((b) => b.codigo).sort();
    expect(azules).toEqual([...AZULES_2026].sort());
  });

  it('ninguna playa lleva banderaAzul de otro año', () => {
    const raras = backend.filter((b) => b.banderaAzul != null && b.banderaAzul !== 2026);
    expect(raras).toEqual([]);
  });
});

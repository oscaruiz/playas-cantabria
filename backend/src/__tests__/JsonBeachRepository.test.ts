import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JsonBeachRepository } from '../infrastructure/repositories/JsonBeachRepository';
import { InMemoryCache } from '../infrastructure/cache/InMemoryCache';
import { BeachMapper } from '../application/mappers/BeachMapper';

// Round-trip raw catalog JSON → entity (neutral FlagRefs) → public DTO.
// Guards the contract-parity edge cases the API contract test cannot see
// (it injects already-mapped entities): station ids that are 0 (pending)
// or absent must round-trip to the DTO exactly as the catalog wrote them,
// while only ids > 0 become queryable FlagRefs.
const RAW = [
  {
    nombre: 'Multi', municipio: 'Test', codigo: '3900001', lat: 43.4, lon: -3.8,
    idCruzRoja: 0,
    cruzRojaStations: [
      { id: 0, nombreFuente: 'PENDIENTE CON CERO' },
      { nombreFuente: 'SIN ID' },
      { id: 42, nombreFuente: 'ACTIVO' },
    ],
  },
  { nombre: 'Simple', municipio: 'Test', codigo: '3900002', lat: 43.4, lon: -3.8, idCruzRoja: 373 },
  { nombre: 'SinCobertura', municipio: 'Test', codigo: '3900003', lat: 43.4, lon: -3.8, idCruzRoja: 0 },
];

let dir: string;
let repo: JsonBeachRepository;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'beaches-'));
  const file = join(dir, 'beaches.json');
  writeFileSync(file, JSON.stringify(RAW), 'utf-8');
  repo = new JsonBeachRepository(new InMemoryCache(), file);
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('JsonBeachRepository — derivación de FlagRefs', () => {
  it('solo los puestos con id > 0 obtienen ref consultable; el id literal se conserva en sourceId', async () => {
    const multi = await repo.getById('3900001');
    expect(multi?.flagStations).toEqual([
      { sourceId: 0, sourceName: 'PENDIENTE CON CERO' },
      { sourceName: 'SIN ID' },
      { ref: { provider: 'cruzroja', ref: 42 }, sourceId: 42, sourceName: 'ACTIVO' },
    ]);
    // idCruzRoja explícito 0 → la ref primaria se deriva del primer puesto con id > 0
    expect(multi?.flagRef).toEqual({ provider: 'cruzroja', ref: 42 });
  });

  it('idCruzRoja explícito > 0 se convierte en la ref primaria', async () => {
    const simple = await repo.getById('3900002');
    expect(simple?.flagRef).toEqual({ provider: 'cruzroja', ref: 373 });
    expect(simple?.flagStations).toBeUndefined();
  });

  it('idCruzRoja 0 sin puestos → sin ref (sin cobertura)', async () => {
    const sin = await repo.getById('3900003');
    expect(sin?.flagRef).toBeUndefined();
  });
});

describe('BeachMapper — paridad del contrato público', () => {
  it('re-publica cruzRojaStations tal cual el catálogo (id 0 incluido) e idCruzRoja derivado', async () => {
    const multi = await repo.getById('3900001');
    const dto = BeachMapper.toDTO(multi!);
    expect(dto.idCruzRoja).toBe(42);
    expect(dto.cruzRojaStations).toEqual([
      { id: 0, nombreFuente: 'PENDIENTE CON CERO' },
      { nombreFuente: 'SIN ID' },
      { id: 42, nombreFuente: 'ACTIVO' },
    ]);
  });

  it('sin cobertura → idCruzRoja 0 y sin clave cruzRojaStations', async () => {
    const sin = await repo.getById('3900003');
    const dto = BeachMapper.toDTO(sin!);
    expect(dto.idCruzRoja).toBe(0);
    expect(dto).not.toHaveProperty('cruzRojaStations');
  });
});

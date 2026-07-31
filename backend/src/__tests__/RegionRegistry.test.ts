import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { RegionRegistry } from '../regions/RegionRegistry';
import { resolveScriptRegion } from '../scripts/scriptRegion';

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('RegionRegistry', () => {
  it('scripts refuse a broken target instead of falling back to another valid region', () => {
    const root = makeRoot();
    writeRegion(root, 'asturias');
    writeRegion(root, 'cantabria', { id: 'wrong-id' });
    const registry = new RegionRegistry(root, { error: () => undefined }).load();

    expect(registry.all().map((region) => region.id)).toEqual(['asturias']);
    expect(resolveScriptRegion('asturias', registry).id).toBe('asturias');
    expect(() => resolveScriptRegion('cantabria', registry)).toThrow(
      'Refusing to run the script against a fallback region',
    );
  });

  it('loads every valid region and resolves its conventional data files', () => {
    const root = makeRoot();
    writeRegion(root, 'valid');

    const registry = new RegionRegistry(root).load();

    expect(registry.all()).toHaveLength(1);
    expect(registry.get('valid')).toMatchObject({
      id: 'valid',
      catalogPath: path.join(root, 'valid', 'beaches.json'),
      flagsPath: path.join(root, 'valid', 'flags.json'),
      snapshotPath: path.join(root, 'valid', 'snapshot.json'),
    });
  });

  it('discards an invalid region without affecting valid ones', () => {
    const root = makeRoot();
    writeRegion(root, 'valid');
    writeRegion(root, 'broken', { id: 'different-id' });
    const errors: string[] = [];

    const registry = new RegionRegistry(root, { error: (message) => errors.push(message) }).load();

    expect(registry.all().map((region) => region.id)).toEqual(['valid']);
    expect(registry.get('broken')).toBeUndefined();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Discarding "broken"');
  });

  it('discards a region whose beach catalog is invalid', () => {
    const root = makeRoot();
    writeRegion(root, 'broken', {}, [{ ...validBeach, lat: 0 }]);

    const registry = new RegionRegistry(root, { error: () => undefined }).load();

    expect(registry.all()).toEqual([]);
  });
});

const validBeach = {
  nombre: 'Test Beach',
  municipio: 'Test Town',
  codigo: '1234567',
  lat: 43.4,
  lon: -3.9,
};

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'regions-'));
  temporaryRoots.push(root);
  return root;
}

function writeRegion(
  root: string,
  directory: string,
  overrides: Record<string, unknown> = {},
  beaches: unknown[] = [validBeach],
): void {
  const regionDir = path.join(root, directory);
  fs.mkdirSync(regionDir);
  const region = {
    id: directory,
    name: 'Test Region',
    observationBbox: { latMin: 42, latMax: 44, lonMin: -5, lonMax: -2 },
    catalogRules: {
      bbox: { latMin: 43, latMax: 44, lonMin: -5, lonMax: -2 },
      regionName: 'Test Region',
      forbiddenBeaches: [],
    },
    flagProviders: [],
    branding: {
      appName: 'Test Beaches',
      shortName: 'Test',
      themeColor: '#0a7ea4',
      backgroundColor: '#faf6f1',
      capacitorAppId: 'com.example.test',
    },
    map: { center: { lat: 43.4, lon: -3.9 }, zoom: 9 },
    ...overrides,
  };
  fs.writeFileSync(path.join(regionDir, 'region.json'), JSON.stringify(region), 'utf8');
  fs.writeFileSync(path.join(regionDir, 'beaches.json'), JSON.stringify(beaches), 'utf8');
}

import fs from 'fs';
import os from 'os';
import path from 'path';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildExpressApp } from '../infrastructure/express/server';
import { InMemoryCache, CacheKeys } from '../infrastructure/cache/InMemoryCache';
import type { RegionConfig } from '../regions';
import { DIContainer } from '../infrastructure/di/DIContainer';
import {
  configureDependencies,
  createSharedDependencies,
} from '../infrastructure/di/dependencies';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'multi-region-routes-'));
const cache = new InMemoryCache();
// Cantabria has a lifeguard operator; Asturias deliberately has none — the
// asymmetry the flag-neutrality work (phase 3) has to survive.
const cantabria = makeRegion('cantabria', 'Cantabria Beach', 373);
const asturias = makeRegion('asturias', 'Asturias Beach');
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = buildExpressApp({ cache, regions: [cantabria, asturias] }).listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  fs.rmSync(root, { recursive: true, force: true });
});

describe('multi-region beach routes', () => {
  it('shares weather providers but keeps regional repositories separate', () => {
    const shared = createSharedDependencies(cache, [cantabria, asturias]);
    const cantabriaContainer = new DIContainer();
    const asturiasContainer = new DIContainer();
    configureDependencies(cantabriaContainer, { region: cantabria, shared });
    configureDependencies(asturiasContainer, { region: asturias, shared });

    expect(cantabriaContainer.get('aemetWeatherProvider')).toBe(
      asturiasContainer.get('aemetWeatherProvider'),
    );
    expect(cantabriaContainer.get('openWeatherProvider')).toBe(
      asturiasContainer.get('openWeatherProvider'),
    );
    expect(cantabriaContainer.get('beachRepository')).not.toBe(
      asturiasContainer.get('beachRepository'),
    );
  });

  it('serves each catalog through its own regional route', async () => {
    const [cantabriaResponse, asturiasResponse] = await Promise.all([
      fetch(`${baseUrl}/api/cantabria/beaches`),
      fetch(`${baseUrl}/api/asturias/beaches`),
    ]);

    expect(cantabriaResponse.status).toBe(200);
    expect(asturiasResponse.status).toBe(200);
    expect((await cantabriaResponse.json())[0].nombre).toBe('Cantabria Beach');
    expect((await asturiasResponse.json())[0].nombre).toBe('Asturias Beach');
  });

  it('isolates catalog cache entries even when beach ids are equal', async () => {
    const [cantabriaResponse, asturiasResponse] = await Promise.all([
      fetch(`${baseUrl}/api/cantabria/beaches/1234567`),
      fetch(`${baseUrl}/api/asturias/beaches/1234567`),
    ]);

    expect((await cantabriaResponse.json()).nombre).toBe('Cantabria Beach');
    expect((await asturiasResponse.json()).nombre).toBe('Asturias Beach');
    expect(cache.state(CacheKeys.beachById('cantabria', '1234567'))).toBe('fresh');
    expect(cache.state(CacheKeys.beachById('asturias', '1234567'))).toBe('fresh');
  });

  it('returns 404 for an unknown region', async () => {
    const response = await fetch(`${baseUrl}/api/unknown/beaches`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not Found' });
  });

  it('names the flag operator per region, and says null where there is none', async () => {
    const [conOperador, sinOperador] = await Promise.all([
      fetch(`${baseUrl}/api/cantabria/beaches`).then((r) => r.json()),
      fetch(`${baseUrl}/api/asturias/beaches`).then((r) => r.json()),
    ]);

    expect(conOperador[0].fuenteBanderas).toBe('Cruz Roja');
    // null, not absent: a client must be able to tell "nobody watches this
    // beach" from "this backend does not report the operator".
    expect(sinOperador[0].fuenteBanderas).toBeNull();
    expect(sinOperador[0]).toHaveProperty('fuenteBanderas');
  });

  it('keeps the Cantabria alias and marks it as deprecated', async () => {
    const response = await fetch(`${baseUrl}/api/beaches`);

    expect(response.status).toBe(200);
    expect(response.headers.get('deprecation')).toBe('true');
    expect(response.headers.get('link')).toBe(
      '</api/cantabria/beaches>; rel="successor-version"',
    );
    expect((await response.json())[0].nombre).toBe('Cantabria Beach');
  });
});

function makeRegion(id: string, beachName: string, idCruzRoja?: number): RegionConfig {
  const regionDir = path.join(root, id);
  fs.mkdirSync(regionDir);
  const catalogPath = path.join(regionDir, 'beaches.json');
  fs.writeFileSync(catalogPath, JSON.stringify([{
    nombre: beachName,
    municipio: `${id} town`,
    codigo: '1234567',
    lat: 43.4,
    lon: -4,
    ...(idCruzRoja ? { idCruzRoja } : {}),
  }]), 'utf8');

  return {
    id,
    name: id,
    observationBbox: { latMin: 42, latMax: 44, lonMin: -6, lonMax: -2 },
    catalogRules: {
      bbox: { latMin: 42, latMax: 44, lonMin: -6, lonMax: -2 },
      regionName: id,
      forbiddenBeaches: [],
    },
    catalogPath,
    flagsPath: path.join(regionDir, 'flags.json'),
    snapshotPath: path.join(regionDir, 'snapshot.json'),
    flagProviders: idCruzRoja ? ['cruzroja'] : [],
    branding: {
      appName: id,
      shortName: id,
      themeColor: '#0a7ea4',
      backgroundColor: '#faf6f1',
      capacitorAppId: `com.example.${id}`,
    },
    map: { center: { lat: 43.4, lon: -4 }, zoom: 9 },
    regionDir,
  };
}

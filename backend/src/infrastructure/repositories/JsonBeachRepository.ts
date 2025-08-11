import fs from 'fs';
import path from 'path';
import { Beach } from '../../domain/entities/Beach';
import { BeachRepository } from '../../domain/ports/BeachRepository';
import { InMemoryCache, CacheKeys } from '../cache/InMemoryCache';

type RawBeach = {
  nombre: string;
  municipio: string;
  codigo: string;
  lat: number;
  lon: number;
  idCruzRoja: number;
};

export class JsonBeachRepository implements BeachRepository {
  private readonly dataPath: string;
  private loaded: Beach[] | null = null;

  constructor(private readonly cache: InMemoryCache, dataFileRelativePath = 'data/beaches.json') {
    this.dataPath = path.resolve(process.cwd(), dataFileRelativePath);
  }

  async getAll(): Promise<Beach[]> {
    // Load once per process; also expose through cache to avoid repeated mapping.
    const cached = this.cache.get<Beach[]>(CacheKeys.beachesAll);
    if (cached) return cached;

    if (!this.loaded) {
      const raw = JSON.parse(fs.readFileSync(this.dataPath, 'utf-8')) as RawBeach[];
      this.loaded = raw.map((b) => this.mapToEntity(b));
    }
    // Save to cache without TTL (treat as immutable)
    this.cache.set(CacheKeys.beachesAll, this.loaded, 60 * 60 * 24 * 365); // 1 year
    return this.loaded;
  }

  async getById(id: string): Promise<Beach | null> {
    const key = CacheKeys.beachById(id);
    const cached = this.cache.get<Beach>(key);
    if (cached) return cached;

    const all = await this.getAll();
    const found = all.find((b) => b.id === id) ?? null;
    if (found) this.cache.set(key, found, 60 * 60 * 24 * 365);
    return found;
  }

  private mapToEntity(r: RawBeach): Beach {
    return {
      id: r.codigo,
      name: r.nombre,
      municipality: r.municipio,
      aemetCode: r.codigo,
      latitude: r.lat,
      longitude: r.lon,
      redCrossId: r.idCruzRoja || 0,
    };
  }
}

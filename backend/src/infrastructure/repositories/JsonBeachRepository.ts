import fs from 'fs/promises';
import path from 'path';
import { Beach, Webcam, CruzRojaStation, BeachSector } from '../../domain/entities/Beach';
import { BeachRepository } from '../../domain/ports/BeachRepository';
import { InMemoryCache, CacheKeys } from '../cache/InMemoryCache';

type RawBeachAttributes = {
  accesoBanista?: boolean;
  accesible?: boolean;
  mascotas?: boolean;
  duchas?: boolean;
  aseos?: boolean;
  parking?: boolean;
  chiringuito?: boolean;
  socorrismo?: boolean;
  nudista?: boolean;
  surf?: boolean;
};

type RawBeach = {
  nombre: string;
  municipio: string;
  codigo: string;
  lat: number;
  lon: number;
  idCruzRoja?: number;
  cruzRojaStations?: Array<{ id?: number; nombreFuente: string }>;
  alias?: string[];
  sectores?: BeachSector[];
  sinAemet?: boolean;
  atributos?: RawBeachAttributes;
  longitud?: number;
  anchura?: number;
  tipoPlaya?: string;
  arena?: string;
  acceso?: string[];
  parkingDescripcion?: string;
  bus?: string;
  hospitalDistancia?: number;
  submarinismo?: boolean;
  webcam?: Webcam;
};

export class JsonBeachRepository implements BeachRepository {
  private readonly dataPath: string;
  private loaded: Beach[] | null = null;

  constructor(private readonly cache: InMemoryCache, dataFileRelativePath = 'data/beaches.json') {
    this.dataPath = path.resolve(process.cwd(), dataFileRelativePath);
  }

  async getAll(): Promise<Beach[]> {
    const cached = this.cache.get<Beach[]>(CacheKeys.beachesAll);
    if (cached) return cached;

    if (!this.loaded) {
      const content = await fs.readFile(this.dataPath, 'utf-8');
      const raw = JSON.parse(content) as RawBeach[];
      this.loaded = raw.map((b) => this.mapToEntity(b));
    }
    this.cache.set(CacheKeys.beachesAll, this.loaded, 60 * 60 * 24 * 365);
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
    const stations: CruzRojaStation[] | undefined = r.cruzRojaStations?.map((s) => ({
      ...(typeof s.id === 'number' ? { id: s.id } : {}),
      nombreFuente: s.nombreFuente,
    }));

    // redCrossId de compatibilidad: el explícito, o el del primer puesto con id.
    const derivedFromStations = stations?.find((s) => typeof s.id === 'number' && s.id > 0)?.id;
    const redCrossId = r.idCruzRoja && r.idCruzRoja > 0 ? r.idCruzRoja : derivedFromStations ?? 0;

    return {
      id: r.codigo,
      name: r.nombre,
      municipality: r.municipio,
      aemetCode: r.codigo,
      latitude: r.lat,
      longitude: r.lon,
      redCrossId,
      ...(stations && stations.length > 0 ? { cruzRojaStations: stations } : {}),
      ...(r.alias && r.alias.length > 0 ? { alias: r.alias } : {}),
      ...(r.sectores && r.sectores.length > 0 ? { sectores: r.sectores } : {}),
      sinAemet: r.sinAemet ?? undefined,
      attributes: r.atributos ?? undefined,
      lengthM: r.longitud,
      widthM: r.anchura,
      beachType: r.tipoPlaya,
      sandType: r.arena,
      access: r.acceso,
      parkingDescription: r.parkingDescripcion,
      busInfo: r.bus,
      hospitalDistanceKm: r.hospitalDistancia,
      diving: r.submarinismo,
      webcam: r.webcam ?? undefined,
    };
  }
}

import fs from 'fs';
import path from 'path';
import type { RawCatalogBeach } from '../domain/services/beachCatalogValidation';
import { validateBeachCatalog } from '../domain/services/beachCatalogValidation';
import type { RegionConfig } from './RegionConfig';
import { parseRegionConfig } from './regionSchema';

export interface RegionRegistryLogger {
  error(message: string): void;
}

const defaultLogger: RegionRegistryLogger = {
  error: (message) => console.error(message),
};

export class RegionRegistry {
  private readonly regions = new Map<string, RegionConfig>();

  constructor(
    private readonly regionsRoot = path.resolve(__dirname, '../../../regions'),
    private readonly logger: RegionRegistryLogger = defaultLogger,
  ) {}

  load(): this {
    this.regions.clear();
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(this.regionsRoot, { withFileTypes: true });
    } catch (error) {
      this.logger.error(`[regions] Cannot read ${this.regionsRoot}: ${formatError(error)}`);
      return this;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) this.loadDirectory(entry.name);
    }
    return this;
  }

  get(id: string): RegionConfig | undefined {
    return this.regions.get(id);
  }

  all(): RegionConfig[] {
    return [...this.regions.values()];
  }

  private loadDirectory(directoryName: string): void {
    const regionDir = path.join(this.regionsRoot, directoryName);
    try {
      const parsed = parseRegionConfig(readJson(path.join(regionDir, 'region.json')));
      if (parsed.id !== directoryName) {
        throw new Error(`id "${parsed.id}" must match directory "${directoryName}"`);
      }

      const catalogPath = path.join(regionDir, 'beaches.json');
      const catalog = readJson(catalogPath);
      if (!Array.isArray(catalog)) throw new Error('beaches.json must contain an array');
      const validation = validateBeachCatalog(catalog as RawCatalogBeach[], parsed.catalogRules);
      if (validation.errors.length > 0) {
        throw new Error(`invalid beach catalog: ${validation.errors.join('; ')}`);
      }

      this.regions.set(parsed.id, {
        ...parsed,
        regionDir,
        catalogPath,
        flagsPath: path.join(regionDir, 'flags.json'),
        snapshotPath: path.join(regionDir, 'snapshot.json'),
      });
    } catch (error) {
      this.logger.error(`[regions] Discarding "${directoryName}": ${formatError(error)}`);
    }
  }
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

import type { FlagProviderId } from '../domain/entities/Flag';
import type { CatalogRules } from '../domain/services/beachCatalogValidation';

export interface RegionBbox {
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

/**
 * Everything region-specific the backend needs, in one place. The engine code
 * (providers, repositories, validation) is region-agnostic and reads from the
 * active region; adding a region means adding a file here plus its data files,
 * not touching engine code.
 */
export interface RegionConfig {
  id: string;
  /** Human-readable region name (logs, error messages). */
  name: string;
  /**
   * Wide bbox (tens of km of margin) used to trim AEMET's Spain-wide
   * observation list down to stations that can serve this region's beaches.
   */
  observationBbox: RegionBbox;
  /** Catalog integrity rules: tight coordinate bbox, known-bad entries. */
  catalogRules: CatalogRules;
  /** Beach catalog JSON, relative to the backend working directory. */
  catalogPath: string;
  /** Pre-scraped flags JSON (cron output), relative to the working directory. */
  flagsPath: string;
  /** Flag operators active in this region (wired in the DI flag router). */
  flagProviders: FlagProviderId[];
}

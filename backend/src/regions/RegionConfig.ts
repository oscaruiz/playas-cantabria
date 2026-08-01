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
  /** Absolute path to the region's beach catalog JSON. */
  catalogPath: string;
  /** Absolute path to the region's pre-scraped flags JSON (cron output). */
  flagsPath: string;
  /** Flag operators active in this region (wired in the DI flag router). */
  flagProviders: FlagProviderId[];
  /** Branding consumed by region-specific frontend builds. */
  branding: {
    appName: string;
    shortName: string;
    themeColor: string;
    backgroundColor: string;
    capacitorAppId: string;
  };
  /** Initial map viewport consumed by the frontend. */
  map: {
    center: { lat: number; lon: number };
    zoom: number;
  };
  /** Region data directory and conventional files resolved by the registry. */
  regionDir: string;
  snapshotPath: string;
}

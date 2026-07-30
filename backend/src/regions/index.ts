import { cantabria } from './cantabria';
import { RegionConfig } from './RegionConfig';

export type { RegionConfig, RegionBbox } from './RegionConfig';

/**
 * The region this backend serves. Single-region for now (Cantabria); when a
 * second region exists, a REGION env var will select it here — engine code
 * must always go through this export, never import a region directly.
 */
export const activeRegion: RegionConfig = cantabria;

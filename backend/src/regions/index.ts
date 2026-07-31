import { RegionRegistry } from './RegionRegistry';

export type { RegionConfig, RegionBbox } from './RegionConfig';
export { RegionRegistry } from './RegionRegistry';
export { parseRegionConfig } from './regionSchema';

/**
 * The loaded regions. There is deliberately no "active region" export: every
 * consumer names the region it wants (HTTP mounts one router per registry
 * entry; scripts and tests go through resolveScriptRegion). A module-level
 * fallback to whichever region happened to load is how the wrong region ends
 * up being read from — or written to — without anyone noticing.
 */
export const regionRegistry = new RegionRegistry().load();

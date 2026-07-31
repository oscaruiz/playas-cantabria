import { regionRegistry, RegionConfig, RegionRegistry } from '../regions';

/**
 * Resolves the region targeted by a script without any fallback. Mutating
 * scripts must fail before reading or writing if their requested region did
 * not pass registry validation.
 */
export function resolveScriptRegion(
  regionId = process.env.REGION ?? 'cantabria',
  registry: RegionRegistry = regionRegistry,
): RegionConfig {
  const region = registry.get(regionId);
  if (!region) {
    const loaded = registry.all().map((candidate) => candidate.id).join(', ') || 'none';
    throw new Error(
      `Region "${regionId}" did not load (regions loaded: ${loaded}). ` +
      'Refusing to run the script against a fallback region.',
    );
  }
  return region;
}

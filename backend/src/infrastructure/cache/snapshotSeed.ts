import fs from 'fs';
import path from 'path';
import { InMemoryCache, CacheKeys } from './InMemoryCache';
import { Config } from '../config/config';
import { debugLog } from '../utils/debug';
import type { RegionConfig } from '../../regions';

/**
 * Cache seed generated in CI (same pattern as a region's flags.json).
 *
 * Render free puts the process to sleep after 15 minutes: without this, the first user
 * who wakes the app up triggers the full /featured fan-out (~200 requests
 * to external providers) and runs into the server's 15 s timeout.
 *
 * The value is seeded as STALE on purpose: it is served instantly and refreshed
 * in the background. It is never passed off as freshly computed.
 */

/** Beyond this the snapshot no longer represents the day (flags, rain). */
const EDAD_MAXIMA_MS = 6 * 60 * 60 * 1000;

export interface SnapshotFile {
  generatedAt: string;
  featured: unknown;
}

export function sembrarDesdeSnapshot(
  cache: InMemoryCache,
  region: Pick<RegionConfig, 'id' | 'snapshotPath'>,
  now: () => number = () => Date.now(),
): boolean {
  try {
    const file = region.snapshotPath;
    const ruta = path.resolve(process.cwd(), file);
    if (!fs.existsSync(ruta)) return false;

    const snap = JSON.parse(fs.readFileSync(ruta, 'utf-8')) as SnapshotFile;
    if (!snap?.featured || !snap.generatedAt) return false;

    const edadMs = now() - Date.parse(snap.generatedAt);
    if (!Number.isFinite(edadMs) || edadMs < 0 || edadMs > EDAD_MAXIMA_MS) {
      debugLog('snapshot.descartado', { generatedAt: snap.generatedAt, edadMs });
      return false;
    }

    cache.seed(
      CacheKeys.featuredBeaches(region.id),
      snap.featured,
      0,
      Config.featuredStaleTtlSeconds(),
    );
    debugLog('snapshot.sembrado', { edadMinutos: Math.round(edadMs / 60000) });
    return true;
  } catch (e: any) {
    debugLog('snapshot.error', { error: e?.message });
    return false;
  }
}

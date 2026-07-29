import fs from 'fs';
import path from 'path';
import { InMemoryCache, CacheKeys } from './InMemoryCache';
import { Config } from '../config/config';
import { debugLog } from '../utils/debug';

/**
 * Semilla de caché generada en CI (mismo patrón que data/flags.json).
 *
 * Render free duerme el proceso a los 15 minutos: sin esto, el primer usuario
 * que despierta la app dispara el fan-out completo de /featured (~200 peticiones
 * a proveedores externos) y se come el timeout de 15 s del servidor.
 *
 * El valor se siembra como STALE a propósito: se sirve al instante y se refresca
 * en segundo plano. Nunca se hace pasar por recién calculado.
 */

/** Más allá de esto el snapshot ya no representa el día (banderas, lluvia). */
const EDAD_MAXIMA_MS = 6 * 60 * 60 * 1000;

export interface SnapshotFile {
  generatedAt: string;
  featured: unknown;
}

export function sembrarDesdeSnapshot(
  cache: InMemoryCache,
  file = 'data/snapshot.json',
  now: () => number = () => Date.now(),
): boolean {
  try {
    const ruta = path.resolve(process.cwd(), file);
    if (!fs.existsSync(ruta)) return false;

    const snap = JSON.parse(fs.readFileSync(ruta, 'utf-8')) as SnapshotFile;
    if (!snap?.featured || !snap.generatedAt) return false;

    const edadMs = now() - Date.parse(snap.generatedAt);
    if (!Number.isFinite(edadMs) || edadMs < 0 || edadMs > EDAD_MAXIMA_MS) {
      debugLog('snapshot.descartado', { generatedAt: snap.generatedAt, edadMs });
      return false;
    }

    cache.seed(CacheKeys.featuredBeaches, snap.featured, 0, Config.featuredStaleTtlSeconds());
    debugLog('snapshot.sembrado', { edadMinutos: Math.round(edadMs / 60000) });
    return true;
  } catch (e: any) {
    debugLog('snapshot.error', { error: e?.message });
    return false;
  }
}

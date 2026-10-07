import { useMemo } from 'react';
import { Beach, FeaturedBeach } from '../../services/api';
import { useRanking } from '../../features/ranking/useRanking';
import { useBeaches } from '../../features/catalog/useBeaches';

/**
 * Catalog + current conditions for the landing pages. `getBeaches` never
 * rejects (backend → saved copy → bundled JSON); conditions are optional
 * enrichment and their failure only means plainer rows.
 */
export function useCatalog(): {
  beaches: Beach[] | null;
  conditions: Map<string, FeaturedBeach>;
  /** Snapshot instant of the conditions (epoch ms), or null while unknown. */
  conditionsInstant: number | null;
} {
  const catalog = useBeaches();
  // Unavailable is an empty catalog, not a spinner: nothing left to wait for.
  const beaches = useMemo(
    () => (catalog.status === 'ready' ? catalog.beaches : catalog.status === 'unavailable' ? [] : null),
    [catalog],
  );
  // The landing says HOW current "current" is, so it takes the instant from
  // the same module that decides which ranking is in force.
  const { ranking, updatedMs: conditionsInstant } = useRanking();
  const conditions = useMemo(
    () => new Map((ranking?.resumenTodas ?? []).map((b) => [b.codigo, b])),
    [ranking],
  );

  return { beaches, conditions, conditionsInstant };
}

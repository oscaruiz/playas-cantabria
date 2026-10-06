import { useEffect, useMemo, useState } from 'react';
import { Beach, FeaturedBeach, getBeaches } from '../../services/api';
import { useRanking } from '../../features/ranking/useRanking';

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
  const [beaches, setBeaches] = useState<Beach[] | null>(null);
  // The landing says HOW current "current" is, so it takes the instant from
  // the same module that decides which ranking is in force.
  const { ranking, updatedMs: conditionsInstant } = useRanking();
  const conditions = useMemo(
    () => new Map((ranking?.resumenTodas ?? []).map((b) => [b.codigo, b])),
    [ranking],
  );

  useEffect(() => {
    let active = true;
    getBeaches({ onBackendData: (d) => { if (active) setBeaches(d); } }).then((d) => {
      if (active) setBeaches(d);
    });
    return () => { active = false; };
  }, []);

  return { beaches, conditions, conditionsInstant };
}

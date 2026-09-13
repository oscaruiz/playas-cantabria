import { useEffect, useMemo, useState } from 'react';
import { Playa, FeaturedBeach, getPlayas } from '../../services/api';
import { useRanking } from '../../features/ranking/useRanking';

/**
 * Catalog + current conditions for the landing pages. `getPlayas` never
 * rejects (backend → saved copy → bundled JSON); conditions are optional
 * enrichment and their failure only means plainer rows.
 */
export function useCatalogo(): {
  playas: Playa[] | null;
  condiciones: Map<string, FeaturedBeach>;
  /** Snapshot instant of the conditions (epoch ms), or null while unknown. */
  instanteCondiciones: number | null;
} {
  const [playas, setPlayas] = useState<Playa[] | null>(null);
  // The landing says HOW current "current" is, so it takes the instant from
  // the same module that decides which ranking is in force.
  const { ranking, actualizadoMs: instanteCondiciones } = useRanking();
  const condiciones = useMemo(
    () => new Map((ranking?.resumenTodas ?? []).map((b) => [b.codigo, b])),
    [ranking],
  );

  useEffect(() => {
    let activo = true;
    getPlayas({ onBackendData: (d) => { if (activo) setPlayas(d); } }).then((d) => {
      if (activo) setPlayas(d);
    });
    return () => { activo = false; };
  }, []);

  return { playas, condiciones, instanteCondiciones };
}

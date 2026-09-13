import { useCallback, useEffect, useState } from 'react';
import {
  Playa,
  FeaturedBeach,
  FeaturedBeachesResponse,
  getPlayas,
  getFeaturedBeaches,
} from '../../services/api';
import { useFeaturedFresco } from '../../hooks/useFeaturedFresco';
import { normalizarInstante } from '../../features/provenance/procedencia';

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
  const [condiciones, setCondiciones] = useState<Map<string, FeaturedBeach>>(new Map());
  const [instanteCondiciones, setInstanteCondiciones] = useState<number | null>(null);

  const aplicarCondiciones = useCallback((r: FeaturedBeachesResponse) => {
    setCondiciones(new Map(r.resumenTodas.map((b) => [b.codigo, b])));
    // The snapshot may come from the service worker's cache: its own
    // timestamp is what lets the page say HOW current "current" is.
    setInstanteCondiciones(normalizarInstante(r.timestamp));
  }, []);

  // And when the copy it served is superseded, the landing says so too.
  useFeaturedFresco(aplicarCondiciones);

  useEffect(() => {
    let activo = true;
    getPlayas({ onBackendData: (d) => { if (activo) setPlayas(d); } }).then((d) => {
      if (activo) setPlayas(d);
    });
    getFeaturedBeaches()
      .then((r) => {
        if (!activo) return;
        aplicarCondiciones(r);
      })
      .catch(() => { /* enrichment only */ });
    return () => { activo = false; };
  }, [aplicarCondiciones]);

  return { playas, condiciones, instanteCondiciones };
}

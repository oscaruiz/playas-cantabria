import { useEffect, useState } from 'react';
import {
  Playa,
  FeaturedBeach,
  getPlayas,
  getFeaturedBeaches,
} from '../../services/api';

/**
 * Catalog + current conditions for the landing pages. `getPlayas` never
 * rejects (backend → saved copy → bundled JSON); conditions are optional
 * enrichment and their failure only means plainer rows.
 */
export function useCatalogo(): {
  playas: Playa[] | null;
  condiciones: Map<string, FeaturedBeach>;
} {
  const [playas, setPlayas] = useState<Playa[] | null>(null);
  const [condiciones, setCondiciones] = useState<Map<string, FeaturedBeach>>(new Map());

  useEffect(() => {
    let activo = true;
    getPlayas({ onBackendData: (d) => { if (activo) setPlayas(d); } }).then((d) => {
      if (activo) setPlayas(d);
    });
    getFeaturedBeaches()
      .then((r) => {
        if (!activo) return;
        setCondiciones(new Map(r.resumenTodas.map((b) => [b.codigo, b])));
      })
      .catch(() => { /* enrichment only */ });
    return () => { activo = false; };
  }, []);

  return { playas, condiciones };
}

import { useSyncExternalStore } from 'react';
import {
  suscribirInstalacion,
  ofertaActual,
  lanzarPrompt,
  abrirApp,
} from '../infrastructure/promptInstalacion';
import type { Oferta } from '../domain/queOfrecer';

/**
 * React binding over the module's single store. There is one install event per
 * page load, so there is one store: every component that asks gets the same
 * answer without a provider.
 */
export function useInstalacion(): { oferta: Oferta; instalar: () => void; abrir: () => void } {
  // Third argument: the prerendered HTML has no browser to ask, and offering
  // an install button in a static page would be a lie.
  const oferta = useSyncExternalStore(suscribirInstalacion, ofertaActual, () => null);

  return {
    oferta,
    instalar: () => {
      void lanzarPrompt();
    },
    abrir: abrirApp,
  };
}

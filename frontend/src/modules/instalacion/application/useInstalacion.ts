import { useSyncExternalStore } from 'react';
import {
  subscribeInstall,
  currentOffer,
  launchPrompt,
  openApp,
} from '../infrastructure/promptInstalacion';
import type { Offer } from '../domain/queOfrecer';

/**
 * React binding over the module's single store. There is one install event per
 * page load, so there is one store: every component that asks gets the same
 * answer without a provider.
 */
export function useInstall(): { offer: Offer; install: () => void; open: () => void } {
  // Third argument: the prerendered HTML has no browser to ask, and offering
  // an install button in a static page would be a lie.
  const offer = useSyncExternalStore(subscribeInstall, currentOffer, () => null);

  return {
    offer,
    install: () => {
      void launchPrompt();
    },
    open: openApp,
  };
}

import { useEffect, useState } from 'react';
import { Beach, getBeaches } from '../../services/api';

/**
 * The catalog as a screen sees it. `getBeaches` never rejects (backend → saved
 * copy → bundled JSON), so "ready" may be a local copy: `source` says which,
 * and a copy can still be replaced by the backend's answer when it lands late.
 * "unavailable" is the one real failure: not even the local copy loaded.
 */
export type BeachesState =
  | { status: 'loading' }
  | { status: 'ready'; beaches: Beach[]; source: 'backend' | 'fallback' }
  | { status: 'unavailable' };

export function useBeaches(): BeachesState {
  const [state, setState] = useState<BeachesState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    let source: 'backend' | 'fallback' = 'backend';
    let unavailable = false;
    // The backend can land while the local copy is still loading; the copy
    // must not then overwrite it.
    let backendArrived = false;
    getBeaches({
      onFallback: () => { source = 'fallback'; },
      onFallbackUnavailable: () => { unavailable = true; },
      onBackendData: (beaches) => {
        backendArrived = true;
        if (active) setState({ status: 'ready', beaches, source: 'backend' });
      },
    }).then((beaches) => {
      if (!active || backendArrived) return;
      setState(unavailable ? { status: 'unavailable' } : { status: 'ready', beaches, source });
    });
    return () => { active = false; };
  }, []);

  return state;
}

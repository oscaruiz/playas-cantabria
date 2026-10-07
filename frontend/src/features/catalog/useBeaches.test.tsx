import { renderHook, waitFor } from '@testing-library/react';
import { Beach } from '../../services/api';

const mockGetBeaches = jest.fn();
jest.mock('../../services/api', () => ({ getBeaches: (o: unknown) => mockGetBeaches(o) }));

import { useBeaches } from './useBeaches';

const local = [{ codigo: 'local' }] as Beach[];
const live = [{ codigo: 'live' }] as Beach[];

afterEach(() => mockGetBeaches.mockReset());

describe('useBeaches', () => {
  it('goes loading → ready from the backend', async () => {
    mockGetBeaches.mockResolvedValue(live);
    const { result } = renderHook(() => useBeaches());

    expect(result.current).toEqual({ status: 'loading' });
    await waitFor(() =>
      expect(result.current).toEqual({ status: 'ready', beaches: live, source: 'backend' }),
    );
  });

  it('paints the local copy as fallback, then the backend when it lands late', async () => {
    let options: { onFallback: () => void; onBackendData: (b: Beach[]) => void } | undefined;
    mockGetBeaches.mockImplementation((o) => {
      options = o;
      o.onFallback();
      return Promise.resolve(local);
    });
    const { result } = renderHook(() => useBeaches());

    await waitFor(() =>
      expect(result.current).toEqual({ status: 'ready', beaches: local, source: 'fallback' }),
    );
    options?.onBackendData(live);
    await waitFor(() =>
      expect(result.current).toEqual({ status: 'ready', beaches: live, source: 'backend' }),
    );
  });

  it('does not let a slow local copy overwrite the backend answer', async () => {
    let resolveLocal: (b: Beach[]) => void = () => undefined;
    mockGetBeaches.mockImplementation((o) => {
      o.onFallback();
      o.onBackendData(live);
      return new Promise((r) => { resolveLocal = r; });
    });
    const { result } = renderHook(() => useBeaches());

    resolveLocal(local);
    await waitFor(() =>
      expect(result.current).toEqual({ status: 'ready', beaches: live, source: 'backend' }),
    );
  });

  it('reports unavailable when not even the local copy loads', async () => {
    mockGetBeaches.mockImplementation((o) => {
      o.onFallback();
      o.onFallbackUnavailable();
      return Promise.resolve([]);
    });
    const { result } = renderHook(() => useBeaches());

    await waitFor(() => expect(result.current).toEqual({ status: 'unavailable' }));
  });
});

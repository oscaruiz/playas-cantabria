/**
 * CHARACTERIZATION — FROZEN.
 *
 * Loading and error states of `PlayasList`. They go in their own file because
 * they need the `services/api.ts` cache empty, and jest only starts a fresh
 * module registry between files, not between tests.
 *
 * Finding that this file pinned down: **the error state was unreachable**.
 * `getPlayas()` never rejects (it falls back to the local JSON on any failure),
 * so the page's `.catch(() => setError(true))` would only have fired if the
 * `import()` of the bundled JSON itself failed. With the backend down the
 * user sees the full listing, not an error.
 *
 * That dead branch has already been removed, and in its place there is a local
 * data notice: see `beachListPage.fallbackNotice.test.tsx`. The tests here are
 * still valid as they are, because they check that the error message does NOT appear.
 */

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import PlayasList from '../../pages/PlayasList';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route, deferred, RouteSpec } from '../http/fakeFetch';
import { RUTA_DESTACADAS as FEATURED, RUTA_PLAYAS as BEACHES } from '../apiRoutes';


afterEach(() => {
  restoreFetch();
});

describe('PlayasList — estados', () => {
  it('muestra el spinner mientras no hay datos y lo sustituye al llegar', async () => {
    const pending = deferred<RouteSpec>();
    installFetchMock([
      route(FEATURED, () => pending.promise),
      route(BEACHES, () => pending.promise),
    ]);

    renderWithProviders(<PlayasList />, { route: '/playas' });

    expect(screen.getByText('Cargando playas...')).toBeInTheDocument();
    expect(screen.queryByText('No se pudieron cargar las playas')).not.toBeInTheDocument();

    // The request has to be allowed to finish: `services/api.ts` stores the
    // in-flight request in a module variable and only clears it in the
    // `.finally`. If it is left hanging, the next test in this file would
    // reuse that eternal promise. Releasing it also checks that the
    // spinner gives way to the listing.
    pending.reject(new Error('backend caído'));

    await waitFor(() => expect(screen.getByText('46 playas')).toBeInTheDocument());
    expect(screen.queryByText('Cargando playas...')).not.toBeInTheDocument();
  });

  it('con el backend caído pinta el JSON local, no el estado de error', async () => {
    installFetchMock([
      route(FEATURED, { networkError: true }),
      route(BEACHES, { networkError: true }),
    ]);

    renderWithProviders(<PlayasList />, { route: '/playas' });

    // 46 beaches: the complete `src/data/beaches.json` file.
    await waitFor(() => expect(screen.getByText('46 playas')).toBeInTheDocument());
    expect(screen.queryByText('No se pudieron cargar las playas')).not.toBeInTheDocument();
  });
});

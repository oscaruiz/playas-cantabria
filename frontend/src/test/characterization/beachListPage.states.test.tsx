/**
 * CARACTERIZACIÓN — CONGELADO.
 *
 * Estados de carga y error de `PlayasList`. Van en su propio fichero porque
 * necesitan la caché de `services/api.ts` vacía, y jest solo estrena el
 * registro de módulos entre ficheros, no entre tests.
 *
 * Hallazgo que este fichero dejó fijado: **el estado de error era inalcanzable**.
 * `getPlayas()` nunca rechaza (cae al JSON local ante cualquier fallo), así que
 * el `.catch(() => setError(true))` de la página solo se habría disparado si
 * fallase el propio `import()` del JSON empaquetado. Con el backend caído el
 * usuario ve el listado completo, no un error.
 *
 * Esa rama muerta ya se ha eliminado, y en su lugar hay un aviso de datos
 * locales: ver `beachListPage.fallbackNotice.test.tsx`. Los tests de aquí siguen
 * valiendo tal cual, porque comprueban que el mensaje de error NO aparece.
 */

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import PlayasList from '../../pages/PlayasList';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route, deferred, RouteSpec } from '../http/fakeFetch';

const FEATURED = '/api/beaches/featured';
const BEACHES = /\/api\/beaches$/;

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

    // Hay que dejar que la petición termine: `services/api.ts` guarda la
    // petición en vuelo en una variable de módulo y solo la limpia en el
    // `.finally`. Si se deja colgada, el siguiente test de este fichero
    // reutilizaría esa promesa eterna. Al soltarla se comprueba además que el
    // spinner da paso al listado.
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

    // 46 playas: el fichero `src/data/beaches.json` completo.
    await waitFor(() => expect(screen.getByText('46 playas')).toBeInTheDocument());
    expect(screen.queryByText('No se pudieron cargar las playas')).not.toBeInTheDocument();
  });
});

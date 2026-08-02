/**
 * The two detail routes over the REAL page: the canonical slug route
 * resolves against the catalog, the legacy code route keeps working, and
 * both declare the slug URL as canonical (that is how old links "resolve"
 * without a client redirect).
 */

import React from 'react';
import { screen } from '@testing-library/react';
import PlayaDetallePage from '../pages/PlayaDetalle';
import { renderWithProviders } from '../test/render';
import { installFetchMock, restoreFetch, route } from '../test/http/fakeFetch';
import { beachesResponse } from '../test/fixtures/beaches';
import { featuredResponse } from '../test/fixtures/featured';
import { buildOpenWeatherDetail } from '../test/fixtures/beachDetail';
import { localNoon } from '../test/time';
import { RUTA_DESTACADAS, RUTA_PLAYAS, RUTA_DETALLE } from '../test/apiRoutes';

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = installFetchMock([
    route(RUTA_DESTACADAS, { json: featuredResponse }),
    route(RUTA_PLAYAS, { json: beachesResponse }),
    route(RUTA_DETALLE, { json: buildOpenWeatherDetail(localNoon('2026-07-27')) }),
  ]);
});

afterEach(() => {
  restoreFetch();
});

describe('ruta canónica /playas/:municipio/:playa', () => {
  it('resuelve los slugs contra el catálogo y pide el detalle por código', async () => {
    renderWithProviders(<PlayaDetallePage />, {
      route: '/playas/suances/la-concha',
      path: '/playas/:municipio/:playa',
    });

    // The detail fixture answers whatever code is asked: what matters is
    // WHICH code the resolution asked for.
    await screen.findByText('La Arnía');
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/beaches/3908503/details'))).toBe(true);
  });

  it('unos slugs desconocidos muestran el error con su causa (404)', async () => {
    renderWithProviders(<PlayaDetallePage />, {
      route: '/playas/suances/no-existe',
      path: '/playas/:municipio/:playa',
    });

    expect(await screen.findByText('HTTP 404')).toBeInTheDocument();
  });
});

describe('ruta heredada /playas/:codigo', () => {
  it('sigue funcionando y declara como canónica la URL con slugs', async () => {
    renderWithProviders(<PlayaDetallePage />, {
      route: '/playas/3905201',
      path: '/playas/:codigo',
    });

    await screen.findByText('La Arnía');
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    // buildOpenWeatherDetail is La Arnía (Piélagos): the canonical URL is
    // derived from the SAME beachUrls module the app navigates with.
    expect(canonical?.href).toBe(`${window.location.origin}/playas/pielagos/la-arnia`);
  });
});

/**
 * The two detail routes over the REAL page: the canonical slug route
 * resolves against the catalog, the legacy code route keeps working, and
 * both declare the slug URL as canonical (that is how old links "resolve"
 * without a client redirect).
 */

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useHistory } from 'react-router-dom';
import PlayaDetallePage from '../../pages/PlayaDetalle';
import { renderWithProviders } from '../../test/render';
import { installFetchMock, restoreFetch, route, deferred, RouteSpec } from '../../test/http/fakeFetch';
import { beachesResponse } from '../../test/fixtures/beaches';
import { featuredResponse } from '../../test/fixtures/featured';
import { buildOpenWeatherDetail } from '../../test/fixtures/beachDetail';
import { localNoon } from '../../test/time';
import { RUTA_DESTACADAS, RUTA_PLAYAS, RUTA_DETALLE } from '../../test/apiRoutes';

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
    // Not-found pages must never present themselves as another page.
    await waitFor(() =>
      expect(
        document.head.querySelector('meta[name="robots"]')?.getAttribute('content')
      ).toBe('noindex')
    );
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});

/** Pushes a new route without unmounting the page — Ionic's view reuse. */
const CambiarRuta: React.FC<{ a: string }> = ({ a }) => {
  const history = useHistory();
  return <button onClick={() => history.push(a)}>cambiar-ruta</button>;
};

describe('reutilización de la vista entre playas', () => {
  // The harness router is plain MemoryRouter ON PURPOSE (see
  // src/test/render.tsx): the page only needs React Router's params, and
  // what this pins is the page's own guarantee — the derived-state guard
  // clears the previous beach the moment the route identity changes.
  it('al cambiar de playa, la anterior desaparece EN EL ACTO, y su fallo no la resucita', async () => {
    const respuestaB = deferred<RouteSpec>();
    let llamadas = 0;
    fetchMock = installFetchMock([
      route(RUTA_DESTACADAS, { json: featuredResponse }),
      route(RUTA_PLAYAS, { json: beachesResponse }),
      route(RUTA_DETALLE, () =>
        llamadas++ === 0
          ? { json: buildOpenWeatherDetail(localNoon('2026-07-27')) }
          : respuestaB.promise
      ),
    ]);

    const { container } = renderWithProviders(
      <>
        <PlayaDetallePage />
        <CambiarRuta a="/playas/9999999" />
      </>,
      { route: '/playas/3905201', path: '/playas/:codigo' }
    );
    await screen.findByText('La Arnía');

    fireEvent.click(screen.getByText('cambiar-ruta'));

    // IMMEDIATELY — with B still pending — the old beach is gone and the
    // loading state shows. Not one paint of A under B's URL.
    expect(screen.queryByText('La Arnía')).not.toBeInTheDocument();
    expect(container.querySelector('.loading-container')).not.toBeNull();

    respuestaB.resolve({ status: 404, json: {} });
    expect(await screen.findByText('HTTP 404')).toBeInTheDocument();
    expect(screen.queryByText('La Arnía')).not.toBeInTheDocument();
  });
});

describe('compartir desde el detalle', () => {
  it('sin Web Share API copia la URL canónica y lo dice un momento', async () => {
    const escribir = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: escribir },
    });

    renderWithProviders(<PlayaDetallePage />, {
      route: '/playas/3905201',
      path: '/playas/:codigo',
    });
    await screen.findByText('La Arnía');

    fireEvent.click(screen.getByRole('button', { name: /Compartir/ }));

    await screen.findByText('Enlace copiado');
    expect(escribir).toHaveBeenCalledWith(
      `${window.location.origin}/playas/pielagos/la-arnia`
    );
  });
});

describe('ruta heredada /playas/:codigo', () => {
  it('sigue funcionando y declara como canónica la URL con slugs', async () => {
    renderWithProviders(<PlayaDetallePage />, {
      route: '/playas/3905201',
      path: '/playas/:codigo',
    });

    await screen.findByText('La Arnía');
    // buildOpenWeatherDetail is La Arnía (Piélagos): the canonical URL is
    // derived from the SAME beachUrls module the app navigates with. SeoHead
    // applies it in an effect, one tick after the data render.
    await waitFor(() =>
      expect(
        document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href
      ).toBe(`${window.location.origin}/playas/pielagos/la-arnia`)
    );
    // And the sibling-beaches link points at the municipality page.
    expect(
      screen.getByRole('link', { name: /Otras playas del municipio de Piélagos/ })
    ).toHaveAttribute('href', '/municipios/pielagos');
  });
});

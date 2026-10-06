/**
 * The two detail routes over the REAL page: the canonical slug route
 * resolves against the catalog, the legacy code route keeps working, and
 * both declare the slug URL as canonical (that is how old links "resolve"
 * without a client redirect).
 */

import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { useHistory } from 'react-router-dom';
import BeachDetailPage from '../../pages/BeachDetailPage';
import { renderWithProviders } from '../../test/render';
import { installFetchMock, restoreFetch, route, deferred, RouteSpec } from '../../test/http/fakeFetch';
import { beachesResponse } from '../../test/fixtures/beaches';
import { featuredResponse } from '../../test/fixtures/featured';
import { buildOpenWeatherDetail } from '../../test/fixtures/beachDetail';
import { localNoon } from '../../test/time';
import { FEATURED_PATH, BEACHES_PATH, DETAIL_PATH } from '../../test/apiRoutes';

let fetchMock: jest.Mock;

beforeEach(() => {
  fetchMock = installFetchMock([
    route(FEATURED_PATH, { json: featuredResponse }),
    route(BEACHES_PATH, { json: beachesResponse }),
    route(DETAIL_PATH, { json: buildOpenWeatherDetail(localNoon('2026-07-27')) }),
  ]);
});

afterEach(() => {
  restoreFetch();
});

describe('canonical route /playas/:municipio/:playa', () => {
  it('resolves the slugs against the catalog and requests the detail by code', async () => {
    renderWithProviders(<BeachDetailPage />, {
      route: '/playas/suances/la-concha',
      path: '/playas/:municipio/:playa',
    });

    // The detail fixture answers whatever code is asked: what matters is
    // WHICH code the resolution asked for.
    await screen.findByText('La Arnía');
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/beaches/3908503/details'))).toBe(true);
  });

  it('unknown slugs show the error with its cause (404)', async () => {
    renderWithProviders(<BeachDetailPage />, {
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
const ChangeRoute: React.FC<{ a: string }> = ({ a }) => {
  const history = useHistory();
  return <button onClick={() => history.push(a)}>cambiar-ruta</button>;
};

describe('view reuse between beaches', () => {
  // The harness router is plain MemoryRouter ON PURPOSE (see
  // src/test/render.tsx): the page only needs React Router's params, and
  // what this pins is the page's own guarantee — the derived-state guard
  // clears the previous beach the moment the route identity changes.
  it('when switching beach, the previous one disappears AT ONCE, and its failure does not resurrect it', async () => {
    const responseB = deferred<RouteSpec>();
    let calls = 0;
    fetchMock = installFetchMock([
      route(FEATURED_PATH, { json: featuredResponse }),
      route(BEACHES_PATH, { json: beachesResponse }),
      route(DETAIL_PATH, () =>
        calls++ === 0
          ? { json: buildOpenWeatherDetail(localNoon('2026-07-27')) }
          : responseB.promise
      ),
    ]);

    const { container } = renderWithProviders(
      <>
        <BeachDetailPage />
        <ChangeRoute a="/playas/9999999" />
      </>,
      { route: '/playas/3905201', path: '/playas/:codigo' }
    );
    await screen.findByText('La Arnía');

    fireEvent.click(screen.getByText('cambiar-ruta'));

    // IMMEDIATELY — with B still pending — the old beach is gone and the
    // loading state shows. Not one paint of A under B's URL.
    expect(screen.queryByText('La Arnía')).not.toBeInTheDocument();
    expect(container.querySelector('.loading-container')).not.toBeNull();

    responseB.resolve({ status: 404, json: {} });
    expect(await screen.findByText('HTTP 404')).toBeInTheDocument();
    expect(screen.queryByText('La Arnía')).not.toBeInTheDocument();
  });
});

describe('sharing from the detail', () => {
  it('without the Web Share API it copies the canonical URL and says so for a moment', async () => {
    const write = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: write },
    });

    renderWithProviders(<BeachDetailPage />, {
      route: '/playas/3905201',
      path: '/playas/:codigo',
    });
    await screen.findByText('La Arnía');

    fireEvent.click(screen.getByRole('button', { name: /Compartir/ }));

    await screen.findByText('Enlace copiado');
    expect(write).toHaveBeenCalledWith(
      `${window.location.origin}/playas/pielagos/la-arnia`
    );
  });
});

describe('legacy route /playas/:codigo', () => {
  it('keeps working and declares the slug URL as canonical', async () => {
    renderWithProviders(<BeachDetailPage />, {
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

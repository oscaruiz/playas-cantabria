/**
 * The same code produces the app of whichever region is built. Everything that
 * used to be hardcoded to Cantabria — the API path, the titles and the map
 * viewport — now comes from `src/data/region.json`, written by the
 * `sync-region` prebuild from root `regions/<id>/region.json`.
 *
 * These tests read the region of the CURRENT build instead of asserting
 * "Cantabria": a literal here would pass for the wrong reason and would stop
 * being true the day the suite runs with `REACT_APP_REGION=asturias`.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import { REGION, REGION_API_PATH } from '../../shared/config/region';
import { buildRegionApiUrl, buildApiUrl } from '../../shared/config/api';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { BEACHES_PATH, FEATURED_PATH } from '../apiRoutes';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';
import BeachList from '../../pages/BeachList';

// The `mock` prefix is what lets jest.mock's factory reference them.
const mockMapCenter: Array<[number, number]> = [];
const mockMapZoom: number[] = [];

jest.mock('react-leaflet', () => {
  const ReactMock = jest.requireActual<typeof import('react')>('react');
  return {
    MapContainer: ReactMock.forwardRef(
      (
        { children, center, zoom }: { children?: React.ReactNode; center: [number, number]; zoom: number },
        ref: React.Ref<unknown>,
      ) => {
        ReactMock.useEffect(() => {
          if (typeof ref === 'function') ref({ flyTo: jest.fn(), closePopup: jest.fn(), invalidateSize: jest.fn() });
        });
        mockMapCenter.push(center);
        mockMapZoom.push(zoom);
        return ReactMock.createElement('div', null, children);
      },
    ),
    TileLayer: () => null,
    Marker: ({ children }: { children?: React.ReactNode }) => ReactMock.createElement('div', null, children),
    Popup: ({ children }: { children?: React.ReactNode }) => ReactMock.createElement('div', null, children),
  };
});

afterEach(() => restoreFetch());

describe('the API URL carries the build region', () => {
  it('composes /api/<region>/<resource>', () => {
    expect(REGION_API_PATH).toBe(`/api/${REGION.id}`);
    expect(buildRegionApiUrl('/beaches')).toBe(buildApiUrl(`/api/${REGION.id}/beaches`));
    // Tolerates the leading slash being absent, like buildApiUrl does.
    expect(buildRegionApiUrl('beaches/featured')).toBe(
      buildApiUrl(`/api/${REGION.id}/beaches/featured`),
    );
  });

  it('does not use the regionless alias, which is only for already installed clients', () => {
    expect(buildRegionApiUrl('/beaches')).not.toBe(buildApiUrl('/api/beaches'));
  });

  it('the app really requests that route', async () => {
    const fetchMock = installFetchMock([
      route(FEATURED_PATH, { json: featuredResponse }),
      route(BEACHES_PATH, { json: beachesResponse }),
    ]);
    renderWithProviders(<BeachList />, { route: '/playas' });
    await screen.findByText(beachesResponse[0].nombre);

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes(`/api/${REGION.id}/beaches`))).toBe(true);
    expect(urls.some((u) => /\/api\/beaches/.test(u))).toBe(false);
  });
});

describe('the header texts carry the region name', () => {
  it('interpolates {region} without the page having to pass it', async () => {
    installFetchMock([
      route(FEATURED_PATH, { json: featuredResponse }),
      route(BEACHES_PATH, { json: beachesResponse }),
    ]);
    renderWithProviders(<BeachList />, { route: '/playas' });

    expect(await screen.findByText(REGION.branding.appName)).toBeInTheDocument();
    // Since Phase 4 the list page titles itself via SeoHead — still with
    // {region}/{marca} interpolated, never hardcoded.
    expect(document.title).toBe(
      `Todas las playas de ${REGION.name} | ${REGION.branding.appName}`
    );
    // The placeholders must never reach the screen.
    expect(screen.queryByText(/\{(region|marca)\}/)).not.toBeInTheDocument();
  });
});

describe('the map starts where the region says', () => {
  it('takes the centre and zoom from region.json', async () => {
    mockMapCenter.length = 0;
    mockMapZoom.length = 0;
    installFetchMock([
      route(FEATURED_PATH, { json: featuredResponse }),
      route(BEACHES_PATH, { json: beachesResponse }),
    ]);
    // Imported here so the react-leaflet mock is in place before the module loads.
    const MapPage = (await import('../../pages/MapPage')).default;
    renderWithProviders(<MapPage />, { route: '/mapa' });
    await screen.findByText(beachesResponse[0].nombre);

    expect(mockMapCenter[0]).toEqual([REGION.map.center.lat, REGION.map.center.lon]);
    expect(mockMapZoom[0]).toBe(REGION.map.zoom);
  });
});

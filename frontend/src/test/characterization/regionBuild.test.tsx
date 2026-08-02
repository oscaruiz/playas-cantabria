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
import { REGION, REGION_API_PATH } from '../../config/region';
import { buildRegionApiUrl, buildApiUrl } from '../../config/api';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { RUTA_PLAYAS, RUTA_DESTACADAS } from '../apiRoutes';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';
import PlayasList from '../../pages/PlayasList';

// The `mock` prefix is what lets jest.mock's factory reference them.
const mockCentroMapa: Array<[number, number]> = [];
const mockZoomMapa: number[] = [];

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
        mockCentroMapa.push(center);
        mockZoomMapa.push(zoom);
        return ReactMock.createElement('div', null, children);
      },
    ),
    TileLayer: () => null,
    Marker: ({ children }: { children?: React.ReactNode }) => ReactMock.createElement('div', null, children),
    Popup: ({ children }: { children?: React.ReactNode }) => ReactMock.createElement('div', null, children),
  };
});

afterEach(() => restoreFetch());

describe('la URL del API lleva la región del build', () => {
  it('compone /api/<region>/<recurso>', () => {
    expect(REGION_API_PATH).toBe(`/api/${REGION.id}`);
    expect(buildRegionApiUrl('/beaches')).toBe(buildApiUrl(`/api/${REGION.id}/beaches`));
    // Tolerates the leading slash being absent, like buildApiUrl does.
    expect(buildRegionApiUrl('beaches/featured')).toBe(
      buildApiUrl(`/api/${REGION.id}/beaches/featured`),
    );
  });

  it('no usa el alias sin región, que es solo para clientes ya instalados', () => {
    expect(buildRegionApiUrl('/beaches')).not.toBe(buildApiUrl('/api/beaches'));
  });

  it('la app pide realmente esa ruta', async () => {
    const fetchMock = installFetchMock([
      route(RUTA_DESTACADAS, { json: featuredResponse }),
      route(RUTA_PLAYAS, { json: beachesResponse }),
    ]);
    renderWithProviders(<PlayasList />, { route: '/playas' });
    await screen.findByText(beachesResponse[0].nombre);

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes(`/api/${REGION.id}/beaches`))).toBe(true);
    expect(urls.some((u) => /\/api\/beaches/.test(u))).toBe(false);
  });
});

describe('los textos de cabecera llevan el nombre de la región', () => {
  it('interpola {region} sin que la página tenga que pasarlo', async () => {
    installFetchMock([
      route(RUTA_DESTACADAS, { json: featuredResponse }),
      route(RUTA_PLAYAS, { json: beachesResponse }),
    ]);
    renderWithProviders(<PlayasList />, { route: '/playas' });

    expect(await screen.findByText(`Playas de ${REGION.name}`)).toBeInTheDocument();
    // Since Phase 4 the list page titles itself via SeoHead — still with
    // {region} interpolated, never hardcoded.
    expect(document.title).toBe(
      `Todas las playas de ${REGION.name} | Playas ${REGION.name}`
    );
    // The placeholder must never reach the screen.
    expect(screen.queryByText(/\{region\}/)).not.toBeInTheDocument();
  });
});

describe('el mapa arranca donde dice la región', () => {
  it('toma el centro y el zoom de region.json', async () => {
    mockCentroMapa.length = 0;
    mockZoomMapa.length = 0;
    installFetchMock([
      route(RUTA_DESTACADAS, { json: featuredResponse }),
      route(RUTA_PLAYAS, { json: beachesResponse }),
    ]);
    // Imported here so the react-leaflet mock is in place before the module loads.
    const MapaPage = (await import('../../pages/MapaPage')).default;
    renderWithProviders(<MapaPage />, { route: '/mapa' });
    await screen.findByText(beachesResponse[0].nombre);

    expect(mockCentroMapa[0]).toEqual([REGION.map.center.lat, REGION.map.center.lon]);
    expect(mockZoomMapa[0]).toBe(REGION.map.zoom);
  });
});

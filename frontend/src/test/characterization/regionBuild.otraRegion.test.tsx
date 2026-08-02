/**
 * Cantabria's `region.json` was written to reproduce exactly what used to be
 * hardcoded, so a test that reads it cannot tell the wiring apart from the old
 * literals. This file replaces the region module with a DIFFERENT one: if any
 * screen still carried Cantabria inside, these assertions fall.
 */

import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../render';
import { installFetchMock, restoreFetch, route } from '../http/fakeFetch';
import { beachesResponse } from '../fixtures/beaches';
import { featuredResponse } from '../fixtures/featured';

const OTRA_REGION = {
  id: 'asturias',
  name: 'Asturias',
  branding: {
    appName: 'Playas de Asturias',
    shortName: 'Playas Asturias',
    themeColor: '#1b6b4a',
    backgroundColor: '#f5f7f2',
    capacitorAppId: 'com.example.asturias',
  },
  map: { center: { lat: 43.45, lon: -5.9 }, zoom: 10 },
};

jest.mock('../../shared/config/region', () => ({
  REGION: {
    id: 'asturias',
    name: 'Asturias',
    branding: {
      appName: 'Playas de Asturias',
      shortName: 'Playas Asturias',
      themeColor: '#1b6b4a',
      backgroundColor: '#f5f7f2',
      capacitorAppId: 'com.example.asturias',
    },
    map: { center: { lat: 43.45, lon: -5.9 }, zoom: 10 },
  },
  REGION_API_PATH: '/api/asturias',
}));

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
          if (typeof ref === 'function') {
            ref({ flyTo: jest.fn(), closePopup: jest.fn(), invalidateSize: jest.fn() });
          }
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

const DESTACADAS = '/api/asturias/beaches/featured';
const PLAYAS = /\/api\/asturias\/beaches$/;

function mockApi() {
  return installFetchMock([
    route(DESTACADAS, { json: featuredResponse }),
    route(PLAYAS, { json: beachesResponse }),
  ]);
}

beforeEach(() => {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined });
});

afterEach(() => restoreFetch());

it('el listado pide /api/asturias y titula con Asturias', async () => {
  const fetchMock = mockApi();
  const PlayasList = (await import('../../pages/PlayasList')).default;
  renderWithProviders(<PlayasList />, { route: '/playas' });

  expect(await screen.findByText('Playas de Asturias')).toBeInTheDocument();
  // Since Phase 4 each page titles itself (SeoHead); the list page's title
  // still must carry the region and never a hardcoded Cantabria.
  expect(document.title).toBe('Todas las playas de Asturias | Playas Asturias');
  expect(screen.queryByText(/Cantabria/)).not.toBeInTheDocument();

  const urls = fetchMock.mock.calls.map((c) => String(c[0]));
  expect(urls.some((u) => u.includes('/api/asturias/beaches'))).toBe(true);
  expect(urls.some((u) => u.includes('/api/cantabria'))).toBe(false);
});

it('el mapa arranca en el centro de Asturias, no en el de Cantabria', async () => {
  mockCentroMapa.length = 0;
  mockZoomMapa.length = 0;
  mockApi();
  const MapaPage = (await import('../../pages/MapaPage')).default;
  renderWithProviders(<MapaPage />, { route: '/mapa' });
  await screen.findByText(beachesResponse[0].nombre);

  expect(mockCentroMapa[0]).toEqual([OTRA_REGION.map.center.lat, OTRA_REGION.map.center.lon]);
  expect(mockZoomMapa[0]).toBe(OTRA_REGION.map.zoom);
});

it('la app en inglés también lleva el nombre de la región', async () => {
  mockApi();
  const PlayasList = (await import('../../pages/PlayasList')).default;
  renderWithProviders(<PlayasList />, { route: '/playas', idioma: 'en' });

  expect(await screen.findByText('Asturias Beaches')).toBeInTheDocument();
});
